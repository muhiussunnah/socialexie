import { NextResponse } from "next/server";
import { generateImage, imageRequestSchema, normalizeImageRequest } from "@/lib/ai/image";
import { NoProviderError } from "@/lib/ai/types";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  // With no Supabase project attached the whole app runs on demo data, so the
  // studio has to stay reachable; once auth exists it is mandatory.
  if (isSupabaseConfigured()) {
    const session = await getSession().catch(() => null);
    if (!session) return fail("Sign in to generate images.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Request body must be JSON.", 400);
  }

  const parsed = imageRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return fail(message, 400);
  }

  try {
    const data = await generateImage(normalizeImageRequest(parsed.data), {
      signal: request.signal,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    // Upstream messages can carry key fragments and echoed prompts, so they are
    // logged and never returned.
    if (error instanceof NoProviderError) {
      console.error("[ai/image] every provider failed", error.attempts);
      return fail(
        "Every configured image provider rejected the request. Try again shortly.",
        502,
      );
    }
    console.error("[ai/image] generation failed", error);
    return fail("Image generation failed.", 500);
  }
}
