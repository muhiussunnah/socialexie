import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession, listWorkspaces } from "@/lib/auth";
import { linkedinAdapter } from "@/lib/publish/adapters/linkedin";
import { persistTokens } from "@/lib/publish/tokens";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Finish the LinkedIn connect flow.
 *
 * Verifies the CSRF cookie, exchanges the returned code for tokens, resolves the
 * member identity, and upserts the connected account under the caller's
 * workspace. Tokens are sealed and written by the shared token store — this
 * route never touches ciphertext directly — and the browser is landed back on
 * the Channels page with a status flag, never a raw error.
 */

const STATE_COOKIE = "li_oauth_state";
const COOKIE_PATH = "/api/oauth/linkedin";
const CALLBACK_PATH = "/api/oauth/linkedin/callback";
const CHANNELS_PATH = "/dashboard/channels";

/** Untyped service client — same trade-off the rest of the pipeline makes. */
function service(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

function siteOrigin(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
}

/** Land back on Channels with a status flag and clear the state cookie. */
function land(origin: string, params: Record<string, string>): NextResponse {
  const url = new URL(CHANNELS_PATH, origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
  return response;
}

interface UpsertedAccount {
  id: string;
}

export async function GET(request: NextRequest) {
  const origin = siteOrigin(request);
  const { searchParams } = request.nextUrl;

  const error = searchParams.get("error");
  if (error) {
    return land(origin, { connect: "linkedin", error: "denied" });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return land(origin, { connect: "linkedin", error: "state" });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL("/login?next=%2Fdashboard%2Fchannels", origin),
    );
  }

  const workspaces = await listWorkspaces();
  const workspace = workspaces[0];
  if (!workspace) {
    return land(origin, { connect: "linkedin", error: "workspace" });
  }

  const redirectUri = new URL(CALLBACK_PATH, origin).toString();

  try {
    const { token, identity } = await linkedinAdapter.exchangeCode({
      code,
      redirectUri,
      codeVerifier: "",
    });

    const db = service();
    const { data, error: upsertError } = await db
      .from("social_accounts")
      .upsert(
        {
          workspace_id: workspace.id,
          platform: "linkedin",
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

    const account = data as UpsertedAccount | null;
    if (upsertError || !account) {
      return land(origin, { connect: "linkedin", error: "save" });
    }

    await persistTokens(account.id, token);
    return land(origin, { connected: "linkedin" });
  } catch {
    return land(origin, { connect: "linkedin", error: "exchange" });
  }
}
