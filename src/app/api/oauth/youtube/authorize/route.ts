import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { youtubeAdapter } from "@/lib/publish/adapters/youtube";

/**
 * Step one of connecting a YouTube channel: mint CSRF state + a PKCE verifier,
 * park them in short-lived httpOnly cookies scoped to the callback, and bounce
 * the browser to Google's consent screen. The verifier never leaves the server;
 * only its S256 challenge travels in the URL, so the callback alone can complete
 * the exchange.
 */

const CHANNELS_PATH = "/dashboard/channels";
const CALLBACK_PATH = "/api/oauth/youtube/callback";
const COOKIE_PATH = "/api/oauth/youtube";
/** Ten minutes is plenty for a consent round-trip and keeps the window tight. */
const STATE_TTL_SECONDS = 600;

function randomToken(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(CHANNELS_PATH)}`, origin),
    );
  }

  const state = randomToken();
  const verifier = randomToken();

  let authorizeUrl: string;
  try {
    authorizeUrl = youtubeAdapter.authorizeUrl({
      redirectUri: `${origin}${CALLBACK_PATH}`,
      state,
      codeChallenge: await pkceChallenge(verifier),
    });
  } catch {
    return NextResponse.redirect(
      new URL(`${CHANNELS_PATH}?error=config`, origin),
    );
  }

  const response = NextResponse.redirect(authorizeUrl);
  const cookie = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: COOKIE_PATH,
    maxAge: STATE_TTL_SECONDS,
  };
  response.cookies.set("yt_oauth_state", state, cookie);
  response.cookies.set("yt_oauth_verifier", verifier, cookie);
  return response;
}
