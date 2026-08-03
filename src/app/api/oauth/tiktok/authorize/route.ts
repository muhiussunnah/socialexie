import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { tiktokAdapter } from "@/lib/publish/adapters/tiktok";

/**
 * TikTok connect — step one.
 *
 * Establishes the CSRF `state` and the PKCE verifier here (not in the adapter,
 * so every network handles it identically), parks them in a short-lived
 * HttpOnly cookie alongside the workspace the channel will attach to, then hands
 * off to TikTok's consent screen. The callback reads that cookie back to finish
 * the exchange. Nothing secret reaches the browser: the cookie holds only the
 * verifier and the target workspace, and it is Secure + SameSite=Lax so it rides
 * the top-level redirect return but not a cross-site request.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALLBACK_PATH = "/api/oauth/tiktok/callback";
export const OAUTH_COOKIE = "tiktok_oauth";
/** Ten minutes is plenty to complete a consent screen and no longer. */
const COOKIE_MAX_AGE = 600;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** PKCE S256 challenge = base64url( SHA-256( verifier ) ). */
async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}

/** Deterministic redirect base so the URI matches the one registered on TikTok. */
function redirectUri(request: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return new URL(CALLBACK_PATH, base).toString();
}

/** The workspace to attach the channel to: the requested one, if the caller is a member. */
async function resolveWorkspace(requested: string | null): Promise<string | null> {
  // RLS-scoped reads, but cast to the untyped client: the hand-maintained type
  // map collapses a narrow `select("id")` to `never` (see licenses.ts).
  const supabase = (await supabaseServer()) as unknown as SupabaseClient;

  if (requested) {
    const { data } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", requested)
      .maybeSingle();
    const row = data as { id: string } | null;
    if (row) return row.id;
  }

  const { data } = await supabase
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
    const next = encodeURIComponent("/dashboard/channels");
    return NextResponse.redirect(new URL(`/login?next=${next}`, origin));
  }

  const workspaceId = await resolveWorkspace(searchParams.get("workspace"));
  if (!workspaceId) {
    return NextResponse.redirect(
      new URL("/dashboard/channels?error=no_workspace", origin),
    );
  }

  const state = randomToken(24);
  const codeVerifier = randomToken(48);

  let authorizeUrl: string;
  try {
    authorizeUrl = tiktokAdapter.authorizeUrl({
      redirectUri: redirectUri(request),
      state,
      codeChallenge: await challengeFor(codeVerifier),
    });
  } catch {
    // Missing TIKTOK_CLIENT_KEY / _SECRET — fail closed with a clear signal.
    return NextResponse.redirect(
      new URL("/dashboard/channels?error=tiktok_unconfigured", origin),
    );
  }

  const store = await cookies();
  store.set(OAUTH_COOKIE, JSON.stringify({ state, codeVerifier, workspaceId }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: CALLBACK_PATH,
    maxAge: COOKIE_MAX_AGE,
  });

  return NextResponse.redirect(authorizeUrl);
}
