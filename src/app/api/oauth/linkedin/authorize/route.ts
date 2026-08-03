import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { linkedinAdapter } from "@/lib/publish/adapters/linkedin";

/**
 * Start the LinkedIn connect flow.
 *
 * Mints a CSRF `state`, parks it in a short-lived host-only cookie scoped to
 * this route family, and redirects the browser to LinkedIn's consent screen.
 * The callback checks the cookie back before it trusts the returned code.
 * LinkedIn is a confidential client, so there is no PKCE verifier to carry.
 */

const STATE_COOKIE = "li_oauth_state";
const STATE_TTL_SECONDS = 600;
const CALLBACK_PATH = "/api/oauth/linkedin/callback";
const COOKIE_PATH = "/api/oauth/linkedin";

/** Canonical site origin — env first so the redirect URI matches what's registered. */
function siteOrigin(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET(request: NextRequest) {
  const origin = siteOrigin(request);

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL("/login?next=%2Fdashboard%2Fchannels", origin),
    );
  }

  const state = randomState();
  const redirectUri = new URL(CALLBACK_PATH, origin).toString();

  // LinkedIn ignores PKCE, so the challenge the contract asks for is empty.
  const authorizeUrl = linkedinAdapter.authorizeUrl({
    redirectUri,
    state,
    codeChallenge: "",
  });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
