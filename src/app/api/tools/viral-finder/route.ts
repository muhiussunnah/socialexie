import { NextResponse } from "next/server";
import { credentialsForUser } from "@/lib/ai/connections";
import { runWithCredentials } from "@/lib/ai/providers";
import { NoProviderError } from "@/lib/ai/types";
import { findViralIdeas, viralRequestSchema } from "@/lib/ai/viral";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  let userId: string | null = null;
  if (isSupabaseConfigured()) {
    const session = await getSession().catch(() => null);
    if (!session) return fail("Sign in to find viral ideas.", 401);
    userId = session.userId;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Request body must be JSON.", 400);
  }

  const parsed = viralRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return fail(message, 400);
  }

  const credentials = userId ? await credentialsForUser(userId) : {};

  try {
    const data = await runWithCredentials(credentials, () =>
      findViralIdeas(parsed.data, { signal: request.signal }),
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof NoProviderError) {
      console.error("[tools/viral-finder] every provider failed", error.attempts);
      return fail(
        "Every configured provider rejected the request. Try again shortly.",
        502,
      );
    }
    console.error("[tools/viral-finder] failed", error);
    return fail("Couldn't find ideas right now.", 500);
  }
}
