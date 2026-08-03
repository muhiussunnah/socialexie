import { NextResponse } from "next/server";
import { credentialsForUser } from "@/lib/ai/connections";
import { runWithCredentials } from "@/lib/ai/providers";
import { generateText, normalizeTextRequest, textRequestSchema } from "@/lib/ai/text";
import { NoProviderError } from "@/lib/ai/types";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  // Mirrors /api/ai/image: demo mode is open, a configured project is not.
  let userId: string | null = null;
  if (isSupabaseConfigured()) {
    const session = await getSession().catch(() => null);
    if (!session) return fail("Sign in to generate captions.", 401);
    userId = session.userId;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Request body must be JSON.", 400);
  }

  const parsed = textRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return fail(message, 400);
  }

  // Prefer the workspace's own keys when it has connected any, so generation
  // spends its quota rather than the platform's shared account.
  const credentials = userId ? await credentialsForUser(userId) : {};

  try {
    const data = await runWithCredentials(credentials, () =>
      generateText(normalizeTextRequest(parsed.data), {
        signal: request.signal,
      }),
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof NoProviderError) {
      console.error("[ai/text] every provider failed", error.attempts);
      return fail(
        "Every configured text provider rejected the request. Try again shortly.",
        502,
      );
    }
    console.error("[ai/text] generation failed", error);
    return fail("Caption generation failed.", 500);
  }
}
