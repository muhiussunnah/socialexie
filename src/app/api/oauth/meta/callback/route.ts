import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { facebookAdapter, instagramAdapter } from "@/lib/publish/adapters/meta";
import { encryptToken } from "@/lib/publish/crypto";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

/**
 * Finish the Meta consent flow.
 *
 * Meta redirects back here with `?code=`. We verify the CSRF `state` against the
 * cookie set at authorize time, exchange the code through the adapter (which
 * also resolves the Page / IG identity), then upsert one social_accounts row —
 * tokens sealed at rest, the Page token already sealed inside provider_metadata
 * by the adapter. The user lands back on the Channels page either way.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "meta_oauth";
const CHANNELS = "/dashboard/channels";

interface StateCookie {
  state: string;
  verifier: string;
  platform: "facebook" | "instagram";
  redirectUri: string;
}

function service(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

function back(origin: string, params: Record<string, string>): Response {
  const url = new URL(CHANNELS, origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(url);
  // The handshake is spent — drop the cookie no matter how this ends.
  response.cookies.set({
    name: STATE_COOKIE,
    value: "",
    path: "/api/oauth/meta",
    maxAge: 0,
  });
  return response;
}

function parseCookie(raw: string | undefined): StateCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StateCookie>;
    if (
      typeof parsed.state === "string" &&
      typeof parsed.verifier === "string" &&
      typeof parsed.redirectUri === "string" &&
      (parsed.platform === "facebook" || parsed.platform === "instagram")
    ) {
      return parsed as StateCookie;
    }
  } catch {
    // fall through
  }
  return null;
}

/** The caller's first workspace, resolved under their session so RLS applies. */
async function resolveWorkspace(): Promise<string | null> {
  const client = (await supabaseServer()) as unknown as SupabaseClient;
  const { data } = await client
    .from("workspaces")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function GET(request: NextRequest): Promise<Response> {
  const { origin, searchParams } = new URL(request.url);

  const session = await getSession();
  if (!session) {
    return back(origin, { error: "session" });
  }

  // User declined, or Meta reported an error on the dialog.
  if (searchParams.get("error")) {
    return back(origin, { error: "denied" });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookie = parseCookie(request.cookies.get(STATE_COOKIE)?.value);

  if (!code || !state || !cookie || cookie.state !== state) {
    return back(origin, { error: "state" });
  }

  const adapter =
    cookie.platform === "instagram" ? instagramAdapter : facebookAdapter;

  let exchanged;
  try {
    exchanged = await adapter.exchangeCode({
      code,
      redirectUri: cookie.redirectUri,
      codeVerifier: cookie.verifier,
    });
  } catch {
    return back(origin, { error: "exchange", platform: cookie.platform });
  }

  const workspaceId = await resolveWorkspace();
  if (!workspaceId) {
    return back(origin, { error: "workspace" });
  }

  try {
    await upsertAccount(workspaceId, session.userId, cookie.platform, exchanged);
  } catch {
    return back(origin, { error: "save", platform: cookie.platform });
  }

  return back(origin, { connected: cookie.platform });
}

async function upsertAccount(
  workspaceId: string,
  userId: string,
  platform: "facebook" | "instagram",
  exchanged: Awaited<ReturnType<typeof facebookAdapter.exchangeCode>>,
): Promise<void> {
  const { token, identity } = exchanged;
  const db = service();

  const patch: Record<string, unknown> = {
    handle: identity.handle,
    display_name: identity.displayName,
    avatar_url: identity.avatarUrl,
    access_token_enc: await encryptToken(token.accessToken),
    refresh_token_enc: token.refreshToken
      ? await encryptToken(token.refreshToken)
      : null,
    token_type: token.tokenType,
    token_expires_at: token.expiresAt ? token.expiresAt.toISOString() : null,
    scopes: token.scopes,
    provider_metadata: identity.metadata,
    status: "active",
    last_error: null,
  };

  const { data: existing } = await db
    .from("social_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("platform", platform)
    .eq("external_id", identity.externalId)
    .maybeSingle();

  const existingId = (existing as { id: string } | null)?.id;
  if (existingId) {
    await db.from("social_accounts").update(patch).eq("id", existingId);
    return;
  }

  await db.from("social_accounts").insert({
    workspace_id: workspaceId,
    platform,
    external_id: identity.externalId,
    connected_by: userId,
    ...patch,
  });
}
