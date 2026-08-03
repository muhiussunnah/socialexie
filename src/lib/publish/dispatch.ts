import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformId } from "@/lib/platforms";
import { adapterFor } from "@/lib/publish/registry";
import { signedUrlForPath } from "@/lib/publish/storage";
import { liveTokenForAccount } from "@/lib/publish/tokens";
import type {
  PublishInput,
  PublishMedia,
  PublishResult,
} from "@/lib/publish/types";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { MediaKind, PostFormatDb } from "@/lib/supabase/types";

/**
 * The dispatcher.
 *
 * Given one due post_target it resolves the post, the connected account and the
 * ordered media, obtains a live token, selects the platform adapter, publishes,
 * and records the outcome back onto the target — retrying transient failures
 * with exponential backoff and flagging the account when a reconnect is the fix.
 * It never branches on platform: `adapterFor` is the only selection point, and
 * adapters surface every failure through PublishResult rather than throwing, so
 * one bad network can't take down a batch.
 */

/** After this many attempts a retryable failure is treated as terminal. */
const MAX_ATTEMPTS = 4;

function service(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** now + 2^attempt minutes — 2, 4, 8, 16… — so a flaky network gets breathing room. */
function backoffIso(attempt: number): string {
  return new Date(Date.now() + Math.pow(2, attempt) * 60_000).toISOString();
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function mimeFor(kind: MediaKind, path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? (kind === "video" ? "video/mp4" : "image/jpeg");
}

interface TargetRow {
  id: string;
  post_id: string;
  social_account_id: string;
  platform: PlatformId;
  caption_override: string | null;
  status: string;
  attempt_count: number;
}

interface PostRow {
  id: string;
  title: string | null;
  body: string;
  format: PostFormatDb;
  status: string;
}

interface MediaRow {
  id: string;
  kind: MediaKind;
  storage_path: string;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  alt_text: string | null;
}

/** Resolve a post's media into publish-ready items, each behind a fresh signed URL. */
async function resolveMedia(
  db: SupabaseClient,
  postId: string,
): Promise<PublishMedia[]> {
  const { data: linkData } = await db
    .from("post_media")
    .select("media_id, position")
    .eq("post_id", postId)
    .order("position", { ascending: true });

  const links = (linkData as { media_id: string; position: number }[] | null) ?? [];
  if (links.length === 0) return [];

  const { data: assetData } = await db
    .from("media_assets")
    .select("id, kind, storage_path, byte_size, width, height, duration_seconds, alt_text")
    .in(
      "id",
      links.map((link) => link.media_id),
    );

  const assets = new Map(
    ((assetData as MediaRow[] | null) ?? []).map((asset) => [asset.id, asset]),
  );

  const media: PublishMedia[] = [];
  for (const link of links) {
    const asset = assets.get(link.media_id);
    if (!asset) continue;
    media.push({
      kind: asset.kind,
      url: await signedUrlForPath(asset.storage_path),
      mimeType: mimeFor(asset.kind, asset.storage_path),
      bytes: asset.byte_size ?? 0,
      width: asset.width,
      height: asset.height,
      durationSeconds: asset.duration_seconds,
      altText: asset.alt_text,
    });
  }
  return media;
}

/** Roll the parent post up once every one of its targets has reached a terminal state. */
async function recomputePost(db: SupabaseClient, postId: string): Promise<void> {
  const { data } = await db
    .from("post_targets")
    .select("status")
    .eq("post_id", postId);

  const statuses = ((data as { status: string }[] | null) ?? []).map(
    (row) => row.status,
  );
  if (statuses.length === 0) return;

  const terminal = statuses.every(
    (status) =>
      status === "published" || status === "failed" || status === "skipped",
  );
  if (!terminal) return;

  const anyPublished = statuses.some((status) => status === "published");
  await db
    .from("posts")
    .update({
      status: anyPublished ? "published" : "failed",
      published_at: anyPublished ? nowIso() : null,
    })
    .eq("id", postId);
}

async function markPublished(
  db: SupabaseClient,
  target: TargetRow,
  result: Extract<PublishResult, { ok: true }>,
): Promise<void> {
  await db
    .from("post_targets")
    .update({
      status: "published",
      external_post_id: result.externalId,
      permalink: result.permalink,
      published_at: nowIso(),
      error: null,
      locked_at: null,
      next_attempt_at: null,
    })
    .eq("id", target.id);
  await recomputePost(db, target.post_id);
}

async function failTarget(
  db: SupabaseClient,
  target: TargetRow,
  error: string,
): Promise<void> {
  await db
    .from("post_targets")
    .update({
      status: "failed",
      error,
      locked_at: null,
      next_attempt_at: null,
    })
    .eq("id", target.id);
  await recomputePost(db, target.post_id);
}

async function scheduleRetry(
  db: SupabaseClient,
  target: TargetRow,
  attempt: number,
  error: string,
): Promise<void> {
  await db
    .from("post_targets")
    .update({
      status: "pending",
      error,
      locked_at: null,
      next_attempt_at: backoffIso(attempt),
    })
    .eq("id", target.id);
  // Not terminal yet, so the post stays in flight; recompute is a no-op here.
}

async function flagAccount(
  db: SupabaseClient,
  accountId: string,
  error: string,
): Promise<void> {
  await db
    .from("social_accounts")
    .update({ status: "expired", last_error: error })
    .eq("id", accountId);
}

/**
 * Publish a single target. Safe to call for a target that is no longer eligible
 * (already published, its post cancelled) — it simply returns.
 */
export async function publishTarget(targetId: string): Promise<void> {
  const db = service();

  const { data: targetData } = await db
    .from("post_targets")
    .select("id, post_id, social_account_id, platform, caption_override, status, attempt_count")
    .eq("id", targetId)
    .maybeSingle();
  const target = targetData as TargetRow | null;
  if (!target) return;
  if (target.status !== "pending" && target.status !== "publishing") return;

  const { data: postData } = await db
    .from("posts")
    .select("id, title, body, format, status")
    .eq("id", target.post_id)
    .maybeSingle();
  const post = postData as PostRow | null;
  if (!post) return;
  if (post.status !== "scheduled" && post.status !== "publishing") return;

  const attempt = target.attempt_count + 1;
  await db
    .from("post_targets")
    .update({
      status: "publishing",
      attempt_count: attempt,
      last_attempt_at: nowIso(),
      locked_at: nowIso(),
    })
    .eq("id", target.id);

  const adapter = adapterFor(target.platform);
  if (!adapter) {
    await failTarget(db, target, "This network isn't available for publishing yet.");
    return;
  }

  const live = await liveTokenForAccount(target.social_account_id);
  if (!live.ok) {
    if (live.needsReconnect) {
      await flagAccount(db, target.social_account_id, live.error);
    }
    await failTarget(db, target, live.error);
    return;
  }

  let media: PublishMedia[];
  try {
    media = await resolveMedia(db, post.id);
  } catch {
    await scheduleRetryOrFail(
      db,
      target,
      attempt,
      "Couldn't prepare the attached media.",
    );
    return;
  }

  const input: PublishInput = {
    caption: (target.caption_override ?? post.body).trim(),
    title: post.title,
    format: post.format,
    media,
    token: live.token,
    account: live.identity,
  };

  let result: PublishResult;
  try {
    result = await adapter.publish(input);
  } catch {
    // Adapters are contracted not to throw, but never let one abort the run.
    result = {
      ok: false,
      error: "Publishing failed unexpectedly.",
      needsReconnect: false,
      retryable: true,
    };
  }

  if (result.ok) {
    await markPublished(db, target, result);
    return;
  }

  if (result.needsReconnect) {
    await flagAccount(db, target.social_account_id, result.error);
    await failTarget(db, target, result.error);
    return;
  }

  await scheduleRetryOrFail(db, target, attempt, result.error, result.retryable);
}

async function scheduleRetryOrFail(
  db: SupabaseClient,
  target: TargetRow,
  attempt: number,
  error: string,
  retryable = true,
): Promise<void> {
  if (retryable && attempt < MAX_ATTEMPTS) {
    await scheduleRetry(db, target, attempt, error);
  } else {
    await failTarget(db, target, error);
  }
}
