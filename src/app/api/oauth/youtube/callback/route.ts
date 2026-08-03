import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { youtubeAdapter } from "@/lib/publish/adapters/youtube";
import { persistTokens } from "@/lib/publish/tokens";
import type { RemoteIdentity } from "@/lib/publish/types";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

/**
 * Step two: Google redirects back with a code. We check the CSRF state against
 * the cookie set at authorize time, exchange the code (with the stored PKCE
 * verifier), and upsert the connected channel. Membership is verified under the
 * caller's session; the ciphertext write runs under the service role — the same
 * split the token store uses, since the encrypted columns aren't RLS-readable.
 */

const CHANNELS_PATH = "/dashboard/channels";
const CALLBACK_PATH = "/api/oauth/youtube/callback";
const COOKIE_PATH = "/api/oauth/youtube";

function service(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

/** Clear the one-shot PKCE/state cookies whichever way the callback exits. */
function clearOauthCookies(response: NextResponse): NextResponse {
  const expire = { path: COOKIE_PATH, maxAge: 0 };
  response.cookies.set("yt_oauth_state", "", expire);
  response.cookies.set("yt_oauth_verifier", "", expire);
  return response;
}

function back(origin: string, error?: string): NextResponse {
  const url = new URL(CHANNELS_PATH, origin);
  if (error) url.searchParams.set("error", error);
  return clearOauthCookies(NextResponse.redirect(url));
}

/** The caller's default workspace, resolved under their session (RLS-enforced). */
async function resolveWorkspace(client: SupabaseClient): Promise<string | null> {
  const { data } = await client
    .from("workspaces")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function upsertAccount(
  admin: SupabaseClient,
  workspaceId: string,
  identity: RemoteIdentity,
  scopes: string[],
  connectedBy: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from("social_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("platform", "youtube")
    .eq("external_id", identity.externalId)
    .maybeSingle();

  const fields = {
    handle: identity.handle,
    display_name: identity.displayName,
    avatar_url: identity.avatarUrl,
    provider_metadata: identity.metadata,
    scopes,
    status: "active",
    last_error: null,
  };

  if (existing) {
    const id = (existing as { id: string }).id;
    await admin.from("social_accounts").update(fields).eq("id", id);
    return id;
  }

  const { data: inserted } = await admin
    .from("social_accounts")
    .insert({
      workspace_id: workspaceId,
      platform: "youtube",
      external_id: identity.externalId,
      connected_by: connectedBy,
      ...fields,
    })
    .select("id")
    .single();

  return (inserted as { id: string } | null)?.id ?? null;
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);

  if (searchParams.get("error")) {
    return back(origin, "denied");
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("yt_oauth_state")?.value;
  const verifier = request.cookies.get("yt_oauth_verifier")?.value;

  if (!code || !state || !storedState || state !== storedState || !verifier) {
    return back(origin, "state");
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(CHANNELS_PATH)}`, origin),
    );
  }

  let token;
  let identity: RemoteIdentity;
  try {
    const exchanged = await youtubeAdapter.exchangeCode({
      code,
      redirectUri: `${origin}${CALLBACK_PATH}`,
      codeVerifier: verifier,
    });
    token = exchanged.token;
    identity = exchanged.identity;
  } catch {
    return back(origin, "exchange");
  }

  const sessionClient = service(await supabaseServer());
  const workspaceId = await resolveWorkspace(sessionClient);
  if (!workspaceId) {
    return back(origin, "workspace");
  }

  const admin = service(supabaseAdmin());
  let accountId: string | null;
  try {
    accountId = await upsertAccount(
      admin,
      workspaceId,
      identity,
      token.scopes,
      session.userId,
    );
  } catch {
    return back(origin, "save");
  }

  if (!accountId) {
    return back(origin, "save");
  }

  try {
    await persistTokens(accountId, token);
  } catch {
    return back(origin, "save");
  }

  return clearOauthCookies(
    NextResponse.redirect(new URL(`${CHANNELS_PATH}?connected=youtube`, origin)),
  );
}
