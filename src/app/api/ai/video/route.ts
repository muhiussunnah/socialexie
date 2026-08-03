import { NextResponse } from "next/server";
import { credentialsForUser } from "@/lib/ai/connections";
import { runWithCredentials } from "@/lib/ai/providers";
import { NoProviderError } from "@/lib/ai/types";
import { generateVideo, normalizeVideoRequest, videoRequestSchema } from "@/lib/ai/video";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";
// Renders can take a while — give the worker room beyond the default.
export const maxDuration = 300;

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  // Mirrors the other AI routes: demo mode is open, a configured project is not.
  let userId: string | null = null;
  if (isSupabaseConfigured()) {
    const session = await getSession().catch(() => null);
    if (!session) return fail("Sign in to generate video.", 401);
    userId = session.userId;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Request body must be JSON.", 400);
  }

  const parsed = videoRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return fail(message, 400);
  }

  // Use the workspace's own keys first when connected; fall back to the shared
  // platform keys otherwise.
  const credentials = userId ? await credentialsForUser(userId) : {};

  try {
    const data = await runWithCredentials(credentials, () =>
      generateVideo(normalizeVideoRequest(parsed.data), {
        signal: request.signal,
      }),
    );
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof NoProviderError) {
      console.error("[ai/video] every provider failed", error.attempts);
      return fail(
        "Every configured video provider rejected the request. Try again shortly.",
        502,
      );
    }
    console.error("[ai/video] generation failed", error);
    return fail("Video generation failed.", 500);
  }
}
