import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Verifies the `token_hash` from a Supabase auth email — signup confirmation,
 * password recovery, magic link or email change — and lands the session cookie
 * before any protected route runs.
 *
 * This is the server-side alternative to letting the browser client parse the
 * URL: with SSR, a protected page renders (and bounces to /login) before the
 * client ever gets a chance to exchange the token, so the exchange has to
 * happen here first.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNext(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link-expired", origin));
}

/** Only ever follow same-site relative paths, never an attacker-supplied origin. */
function sanitizeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}
