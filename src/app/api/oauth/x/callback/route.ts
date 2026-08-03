import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { xAdapter } from "@/lib/publish/adapters/x";
import { persistTokens } from "@/lib/publish/tokens";
import { supabaseAdmin } from "@/lib/supabase/server";
import { X_OAUTH_COOKIE } from "@/app/api/oauth/x/authorize/route";

/**
 * X connect — step two.
 *
 * Opens the envelope the authorize route sealed, checks the returned state
 * against it (CSRF), exchanges the code for tokens with the matching PKCE
 * verifier, upserts the social_accounts row for the target workspace and seals
 * the tokens through the shared token store. The browser is sent back to the
 * Channels page either way, with a flag describing the outcome.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Envelope {
  state: string;
  codeVerifier: string;
  workspaceId: string;
  userId: string;
}

function service(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

function channels(
  origin: string,
  params: Record<string, string>,
): NextResponse {
  const url = new URL("/dashboard/channels", origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(url);
  // Single-use envelope — clear it whatever happened.
  response.cookies.set(X_OAUTH_COOKIE, "", {
    path: "/api/oauth/x",
    maxAge: 0,
  });
  return response;
}

/** Length-checked constant-time compare so a state mismatch leaks no timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function redirectUri(request: NextRequest): string {
  return (
    process.env.X_OAUTH_REDIRECT_URI ??
    new URL("/api/oauth/x/callback", request.nextUrl.origin).toString()
  );
}

function readEnvelope(request: NextRequest): Envelope | null {
  const raw = request.cookies.get(X_OAUTH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Envelope>;
    if (
      typeof parsed.state === "string" &&
      typeof parsed.codeVerifier === "string" &&
      typeof parsed.workspaceId === "string" &&
      typeof parsed.userId === "string"
    ) {
      return parsed as Envelope;
    }
  } catch {
    // Fall through to the null return below.
  }
  return null;
}

export async function GET(request: NextRequest): Promise<Response> {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  // The user declined, or X returned an error instead of a code.
  if (params.get("error")) {
    return channels(origin, { error: "x_denied" });
  }

  const code = params.get("code");
  const state = params.get("state");
  const envelope = readEnvelope(request);

  if (!code || !state || !envelope) {
    return channels(origin, { error: "x_state" });
  }
  if (!timingSafeEqual(state, envelope.state)) {
    return channels(origin, { error: "x_state" });
  }

  // The cookie is httpOnly and server-issued, but confirm the same user is still
  // signed in before writing an account under their workspace.
  const session = await getSession();
  if (!session || session.userId !== envelope.userId) {
    return channels(origin, { error: "x_session" });
  }

  let token;
  let identity;
  try {
    const exchanged = await xAdapter.exchangeCode({
      code,
      redirectUri: redirectUri(request),
      codeVerifier: envelope.codeVerifier,
    });
    token = exchanged.token;
    identity = exchanged.identity;
  } catch {
    return channels(origin, { error: "x_exchange" });
  }

  try {
    const db = service();
    const { data, error } = await db
      .from("social_accounts")
      .upsert(
        {
          workspace_id: envelope.workspaceId,
          platform: "x",
          external_id: identity.externalId,
          handle: identity.handle,
          display_name: identity.displayName,
          avatar_url: identity.avatarUrl,
          provider_metadata: identity.metadata,
          status: "active",
          last_error: null,
          connected_by: session.userId,
        },
        { onConflict: "workspace_id,platform,external_id" },
      )
      .select("id")
      .single();

    if (error || !data) {
      return channels(origin, { error: "x_store" });
    }

    // Seal the tokens through the shared store so encryption stays in one place.
    await persistTokens((data as { id: string }).id, token);
  } catch {
    return channels(origin, { error: "x_store" });
  }

  return channels(origin, { connected: "x" });
}
