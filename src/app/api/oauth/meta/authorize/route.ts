import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { facebookAdapter, instagramAdapter } from "@/lib/publish/adapters/meta";
import { site } from "@/lib/site";

/**
 * Start the Meta consent flow.
 *
 * A signed-in user hits this to connect a Facebook Page or an Instagram
 * business account. Both ride the same Facebook Login, so `?platform=` selects
 * which adapter (and therefore which scopes) to use. A random `state` and a
 * PKCE verifier are minted here and stashed in a short-lived, http-only cookie;
 * the callback checks `state` to defeat CSRF and reuses the exact redirect URI.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cookie carrying the in-flight handshake. Scoped to the Meta OAuth routes. */
const STATE_COOKIE = "meta_oauth";
const STATE_TTL_SECONDS = 600;

const CHANNELS = "/dashboard/channels";

type MetaPlatform = "facebook" | "instagram";

function isMetaPlatform(value: string | null): value is MetaPlatform {
  return value === "facebook" || value === "instagram";
}

/** Same origin authorize and callback agree on, so the exchange matches. */
function redirectBase(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? site.url;
  return configured || new URL(request.url).origin;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}

export async function GET(request: NextRequest): Promise<Response> {
  const { origin, searchParams } = new URL(request.url);

  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent(CHANNELS);
    return NextResponse.redirect(new URL(`/login?next=${next}`, origin));
  }

  const platformParam = searchParams.get("platform");
  const platform: MetaPlatform = isMetaPlatform(platformParam)
    ? platformParam
    : "facebook";
  const adapter = platform === "instagram" ? instagramAdapter : facebookAdapter;

  const redirectUri = `${redirectBase(request)}/api/oauth/meta/callback`;
  const state = randomToken(24);
  const verifier = randomToken(48);

  let authorizeUrl: string;
  try {
    authorizeUrl = adapter.authorizeUrl({
      redirectUri,
      state,
      codeChallenge: await pkceChallenge(verifier),
    });
  } catch {
    return NextResponse.redirect(
      new URL(`${CHANNELS}?error=config`, origin),
    );
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set({
    name: STATE_COOKIE,
    value: JSON.stringify({ state, verifier, platform, redirectUri }),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/oauth/meta",
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
