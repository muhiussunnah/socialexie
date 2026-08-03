import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { socialEnv } from "@/lib/env";
import { publishTarget } from "@/lib/publish/dispatch";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Publishing cron.
 *
 * A minute scheduler calls this to drain the queue: it finds posts whose time
 * has come, claims their pending targets by flipping them to 'publishing' (the
 * conditional update is the lock, so two concurrent runs claim disjoint sets),
 * and hands each to the dispatcher. The only gate is a shared secret — there is
 * no user session — so the secret is compared in constant time and never logged.
 *
 * Cloudflare note: @opennextjs/cloudflare maps HTTP requests, not the Worker
 * `scheduled()` handler, so a bare Cron Trigger won't reach this route. Point a
 * tiny companion Worker's scheduled() — or any external minute scheduler — at
 * this URL with the `x-cron-secret` header. See wrangler.jsonc.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many targets one invocation will claim and publish. */
const BATCH = 20;
/** Cap on how many due posts to scan for candidates in one pass. */
const POST_SCAN = 200;

function service(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

/** Length-checked constant-time compare, so a mismatch leaks no timing signal. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function presentedSecret(request: Request): string | null {
  const header = request.headers.get("x-cron-secret");
  if (header) return header;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return null;
}

function authorized(request: Request): boolean {
  let secret: string;
  try {
    secret = socialEnv().CRON_SECRET;
  } catch {
    // No secret configured — refuse rather than run unauthenticated.
    return false;
  }
  const presented = presentedSecret(request);
  return presented !== null && timingSafeEqual(presented, secret);
}

async function run(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return new NextResponse(null, { status: 401 });
  }

  const db = service();
  const now = new Date().toISOString();
  const empty = { ok: true, claimed: 0, published: 0, failed: 0 } as const;

  // Posts whose scheduled time has arrived.
  const { data: postData } = await db
    .from("posts")
    .select("id")
    .in("status", ["scheduled", "publishing"])
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(POST_SCAN);
  const duePostIds = ((postData as { id: string }[] | null) ?? []).map((p) => p.id);
  if (duePostIds.length === 0) return NextResponse.json(empty);

  // Reflect in-flight state so the UI shows these as publishing.
  await db
    .from("posts")
    .update({ status: "publishing" })
    .in("id", duePostIds)
    .eq("status", "scheduled");

  // Candidate targets: pending, and either never tried or past their backoff.
  const { data: candidateData } = await db
    .from("post_targets")
    .select("id")
    .in("post_id", duePostIds)
    .eq("status", "pending")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .limit(BATCH);
  const candidateIds = ((candidateData as { id: string }[] | null) ?? []).map((t) => t.id);
  if (candidateIds.length === 0) return NextResponse.json(empty);

  // Claim them. The `status = 'pending'` filter on the update is the lock: a
  // second concurrent run finds them already flipped and claims a disjoint set.
  const { data: claimedData } = await db
    .from("post_targets")
    .update({ status: "publishing", locked_at: now })
    .in("id", candidateIds)
    .eq("status", "pending")
    .select("id");
  const claimedIds = ((claimedData as { id: string }[] | null) ?? []).map((t) => t.id);
  if (claimedIds.length === 0) return NextResponse.json(empty);

  // Publish the batch. Dispatch never throws, but guard anyway so one failure
  // can't reject the whole Promise.all.
  await Promise.all(
    claimedIds.map((id) => publishTarget(id).catch(() => undefined)),
  );

  // Tally what actually happened for the response body.
  const { data: outcomeData } = await db
    .from("post_targets")
    .select("status")
    .in("id", claimedIds);
  const statuses = ((outcomeData as { status: string }[] | null) ?? []).map(
    (row) => row.status,
  );

  return NextResponse.json({
    ok: true,
    claimed: claimedIds.length,
    published: statuses.filter((s) => s === "published").length,
    failed: statuses.filter((s) => s === "failed").length,
  });
}

export async function GET(request: Request): Promise<Response> {
  return run(request);
}

export async function POST(request: Request): Promise<Response> {
  return run(request);
}
