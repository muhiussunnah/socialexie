"use server";

import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { isPlatformId, type PlatformId, type PostFormat } from "@/lib/platforms";
import {
  extractHashtags,
  validateForPlatform,
} from "@/lib/post-validation";
import { uploadMedia } from "@/lib/publish/storage";
import { supabaseServer } from "@/lib/supabase/server";
import type { MediaKind } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Composer server action.
 *
 * Turns the browser's draft into real rows: it uploads any attached media,
 * writes the post, links the media, and fans out one post_target per connected
 * account on the selected networks — all under the caller's session so RLS
 * enforces workspace membership and the editor role. The cron dispatcher takes
 * it from there. Everything is serialisable so the client component can call it
 * directly.
 */

export interface ComposeMediaInput {
  /** A `data:` URI carrying the attachment's bytes. */
  dataUri: string;
  kind: MediaKind;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}

export interface ComposePostInput {
  /** Defaults to the caller's first workspace when omitted. */
  workspaceId?: string | null;
  body: string;
  title?: string | null;
  format: PostFormat;
  platforms: PlatformId[];
  /** Per-network caption overrides, keyed by platform id. */
  overrides?: Record<string, string>;
  media?: ComposeMediaInput[];
  /** ISO instant the post should go out; ignored when `postNow` is set. */
  scheduledAt: string | null;
  postNow?: boolean;
}

export type ComposeResult =
  | {
      ok: true;
      postId: string;
      targetCount: number;
      scheduledAt: string;
      receipt: string;
    }
  | { ok: false; error: string };

/**
 * Untyped session client. The hand-maintained table map carries no PostgREST
 * select metadata, so the typed builder collapses to `never`; this still runs
 * under the caller's session, so RLS is fully in force — the cast only sheds the
 * compile-time row types, exactly as the service-role libraries do.
 */
function db(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

async function resolveWorkspace(
  client: SupabaseClient,
  provided: string | null | undefined,
): Promise<string | null> {
  if (provided) {
    const { data } = await client
      .from("workspaces")
      .select("id")
      .eq("id", provided)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  const { data } = await client
    .from("workspaces")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function uploadAll(
  workspaceId: string,
  createdBy: string,
  media: ComposeMediaInput[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const item of media) {
    const uploaded = await uploadMedia(workspaceId, {
      data: item.dataUri,
      kind: item.kind,
      altText: item.altText ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      durationSeconds: item.durationSeconds ?? null,
      createdBy,
    });
    ids.push(uploaded.mediaId);
  }
  return ids;
}

export async function persistComposedPost(
  input: ComposePostInput,
): Promise<ComposeResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Connect Socialexie to a workspace to publish for real.",
    };
  }

  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Your session expired — sign in and try again." };
  }

  const platforms = input.platforms.filter(isPlatformId);
  if (platforms.length === 0) {
    return { ok: false, error: "Pick at least one channel." };
  }

  const client = db(await supabaseServer());

  const workspaceId = await resolveWorkspace(client, input.workspaceId);
  if (!workspaceId) {
    return { ok: false, error: "No workspace available to publish from." };
  }

  // Only fan out to networks that actually have a connected, healthy account.
  const { data: accountData } = await client
    .from("social_accounts")
    .select("id, platform")
    .eq("workspace_id", workspaceId)
    .in("platform", platforms)
    .eq("status", "active");
  const accounts = (accountData as { id: string; platform: PlatformId }[] | null) ?? [];
  if (accounts.length === 0) {
    return {
      ok: false,
      error: "None of the selected channels are connected yet.",
    };
  }

  // Re-run the same pre-flight the composer shows, so a blocked draft can't slip
  // past a stale client. Validate each connected platform against its own caption.
  const connectedPlatforms = Array.from(new Set(accounts.map((a) => a.platform)));
  const mediaCount = input.media?.length ?? 0;
  for (const platform of connectedPlatforms) {
    const body = input.overrides?.[platform] ?? input.body;
    const blocking = validateForPlatform(
      {
        body,
        format: input.format,
        mediaCount,
        hashtags: extractHashtags(body),
        targets: connectedPlatforms,
      },
      platform,
    ).find((issue) => issue.level === "error");
    if (blocking) return { ok: false, error: blocking.message };
  }

  let mediaIds: string[];
  try {
    mediaIds = await uploadAll(workspaceId, session.userId, input.media ?? []);
  } catch {
    return { ok: false, error: "Couldn't upload the attached media." };
  }

  const postNow = input.postNow === true;
  const scheduledAt = postNow ? new Date().toISOString() : input.scheduledAt;
  if (!scheduledAt) {
    return { ok: false, error: "Choose when this should go out." };
  }

  const { data: postData, error: postError } = await client
    .from("posts")
    .insert({
      workspace_id: workspaceId,
      title: input.title ?? null,
      body: input.body,
      format: input.format,
      status: "scheduled",
      scheduled_at: scheduledAt,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (postError || !postData) {
    return { ok: false, error: "Couldn't save the post." };
  }
  const postId = (postData as { id: string }).id;

  if (mediaIds.length > 0) {
    const links = mediaIds.map((mediaId, position) => ({
      post_id: postId,
      media_id: mediaId,
      position,
    }));
    await client.from("post_media").insert(links);
  }

  // One target per connected account, made eligible the moment the post is due.
  const targets = accounts.map((account) => {
    const override = input.overrides?.[account.platform];
    return {
      post_id: postId,
      social_account_id: account.id,
      platform: account.platform,
      caption_override:
        override && override !== input.body ? override : null,
      status: "pending",
      next_attempt_at: scheduledAt,
    };
  });

  const { error: targetError } = await client.from("post_targets").insert(targets);
  if (targetError) {
    return { ok: false, error: "Couldn't queue the selected channels." };
  }

  return {
    ok: true,
    postId,
    targetCount: targets.length,
    scheduledAt,
    receipt: `Scheduled to ${targets.length} channel${targets.length === 1 ? "" : "s"}.`,
  };
}
