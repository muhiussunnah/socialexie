import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { tiktokAdapter } from "@/lib/publish/adapters/tiktok";
import { persistTokens } from "@/lib/publish/tokens";
import type { RemoteIdentity, TokenSet } from "@/lib/publish/types";
import { supabaseAdmin } from "@/lib/supabase/server";
import { OAUTH_COOKIE } from "@/app/api/oauth/tiktok/authorize/route";

/**
 * TikTok connect — step two.
 *
 * Reads the state/verifier cookie back, checks it against the returned `state`
 * (the CSRF gate), exchanges the code for tokens through the adapter, and
 * upserts the connected channel. Tokens never touch this file in the clear
 * beyond memory: persistTokens seals them AES-GCM under the service role, and
 * the row's identity + provider_metadata are written the same way so the
 * ciphertext columns stay unreadable to the browser. The one-time cookie is
 * cleared whatever the outcome.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALLBACK_PATH = "/api/oauth/tiktok/callback";

interface StashedState {
  state: string;
  codeVerifier: string;
  workspaceId: string;
}

function service(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

function redirectUri(request: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return new URL(CALLBACK_PATH, base).toString();
}

function done(origin: string, params: string): Response {
  const response = NextResponse.redirect(
    new URL(`/dashboard/channels?${params}`, origin),
  );
  // Burn the one-time cookie regardless of success or failure.
  response.cookies.set(OAUTH_COOKIE, "", { path: CALLBACK_PATH, maxAge: 0 });
  return response;
}

/** Insert or refresh the channel row, returning its id for the token write. */
async function upsertAccount(
  db: SupabaseClient,
  workspaceId: string,
  connectedBy: string,
  identity: RemoteIdentity,
): Promise<string> {
  const { data: existing } = await db
    .from("social_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("platform", "tiktok")
    .eq("external_id", identity.externalId)
    .maybeSingle();

  const fields = {
    handle: identity.handle,
    display_name: identity.displayName,
    avatar_url: identity.avatarUrl,
    provider_metadata: identity.metadata,
    status: "active" as const,
    last_error: null,
  };

  if (existing) {
    const id = (existing as { id: string }).id;
    await db.from("social_accounts").update(fields).eq("id", id);
    return id;
  }

  const { data: inserted, error } = await db
    .from("social_accounts")
    .insert({
      workspace_id: workspaceId,
      platform: "tiktok",
      external_id: identity.externalId,
      connected_by: connectedBy,
      ...fields,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error("Couldn't record the connected channel.");
  }
  return (inserted as { id: string }).id;
}

export async function GET(request: NextRequest): Promise<Response> {
  const { origin, searchParams } = new URL(request.url);

  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent("/dashboard/channels");
    return NextResponse.redirect(new URL(`/login?next=${next}`, origin));
  }

  // TikTok bounced the consent (denied, closed, etc.).
  if (searchParams.get("error")) {
    return done(origin, "error=tiktok_denied");
  }

  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");

  const store = await cookies();
  const raw = store.get(OAUTH_COOKIE)?.value;
  let stash: StashedState | null = null;
  if (raw) {
    try {
      stash = JSON.parse(raw) as StashedState;
    } catch {
      stash = null;
    }
  }

  if (!code || !returnedState || !stash || stash.state !== returnedState) {
    return done(origin, "error=tiktok_state");
  }

  let token: TokenSet;
  let identity: RemoteIdentity;
  try {
    const exchanged = await tiktokAdapter.exchangeCode({
      code,
      redirectUri: redirectUri(request),
      codeVerifier: stash.codeVerifier,
    });
    token = exchanged.token;
    identity = exchanged.identity;
  } catch {
    return done(origin, "error=tiktok_exchange");
  }

  if (!identity.externalId) {
    return done(origin, "error=tiktok_identity");
  }

  try {
    const db = service();
    const accountId = await upsertAccount(
      db,
      stash.workspaceId,
      session.userId,
      identity,
    );
    await persistTokens(accountId, token);
  } catch {
    return done(origin, "error=tiktok_store");
  }

  return done(origin, "connected=tiktok");
}
