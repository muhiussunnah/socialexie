import { NextResponse, type NextRequest } from "next/server";
import { listWorkspaces } from "@/lib/auth";
import { requireSession } from "@/lib/auth";
import { xAdapter } from "@/lib/publish/adapters/x";

/**
 * X connect — step one.
 *
 * Signs a short-lived PKCE/CSRF envelope into an httpOnly cookie and redirects
 * the browser to X's consent screen. The state token and code verifier are
 * minted here (not in the adapter) so CSRF and PKCE are handled uniformly for
 * every network; the adapter only knows how to shape the authorize URL. The
 * callback route re-opens the same cookie to finish the exchange.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cookie carrying the CSRF state, PKCE verifier and target workspace. */
export const X_OAUTH_COOKIE = "sx_x_oauth";
const COOKIE_TTL_SECONDS = 600;

/** URL-safe base64 with no padding — the encoding OAuth/PKCE expects. */
function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** PKCE S256 challenge for a verifier, using Web Crypto so it runs on the Worker. */
async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}

/**
 * The callback URL X will redirect to. Prefer the explicitly registered value
 * so it matches the X app to the character; fall back to this request's origin.
 */
function redirectUri(request: NextRequest): string {
  return (
    process.env.X_OAUTH_REDIRECT_URI ??
    new URL("/api/oauth/x/callback", request.nextUrl.origin).toString()
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await requireSession("/dashboard/channels");

  // Attach the new channel to the caller's first workspace. Without one there is
  // nowhere to hang the account, so bounce back with a clear flag.
  const workspaces = await listWorkspaces();
  const workspaceId = workspaces[0]?.id;
  if (!workspaceId) {
    return NextResponse.redirect(
      new URL("/dashboard/channels?error=no_workspace", request.nextUrl.origin),
    );
  }

  const state = randomToken(32);
  const codeVerifier = randomToken(48);
  const codeChallenge = await challengeFor(codeVerifier);

  let authorizeUrl: string;
  try {
    authorizeUrl = xAdapter.authorizeUrl({
      redirectUri: redirectUri(request),
      state,
      codeChallenge,
    });
  } catch {
    // Client id/secret not configured yet.
    return NextResponse.redirect(
      new URL("/dashboard/channels?error=x_unconfigured", request.nextUrl.origin),
    );
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    X_OAUTH_COOKIE,
    JSON.stringify({ state, codeVerifier, workspaceId, userId: session.userId }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/oauth/x",
      maxAge: COOKIE_TTL_SECONDS,
    },
  );
  return response;
}
