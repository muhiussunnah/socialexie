import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { MediaKind } from "@/lib/supabase/types";

/**
 * Media storage.
 *
 * Everything the composer attaches or the AI studio generates lands in one
 * private Supabase Storage bucket, laid out as `{workspace_id}/{uuid}.{ext}` so
 * the first path segment is the tenant — exactly what the bucket's RLS policy
 * checks. Uploads run under the service role; adapters only ever receive a
 * short-lived signed URL, so no object is world-readable.
 */

const BUCKET = "media";
const SIGNED_URL_TTL_SECONDS = 3_600;

/**
 * Untyped service client. The hand-maintained table map carries no PostgREST
 * select metadata, so the typed builder collapses to `never`; naming the row
 * shape per query keeps this honest — the same trade-off `licenses.ts` makes.
 */
function service(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

export interface UploadMediaInput {
  /** Raw bytes, or a `data:` URI (the AI studio and the composer both send these). */
  data: Uint8Array | ArrayBuffer | string;
  /** Falls back to the `data:` URI's declared type, then to octet-stream. */
  contentType?: string;
  kind: MediaKind;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  altText?: string | null;
  createdBy?: string | null;
  /** Provenance when the asset came out of the AI studio. */
  ai?: { provider: string; model: string; prompt: string } | null;
}

export interface UploadedMedia {
  mediaId: string;
  /** In-bucket path stored on the media_assets row. */
  path: string;
  signedUrl: string;
  contentType: string;
  byteSize: number;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function extensionFor(contentType: string): string {
  return EXTENSION_BY_TYPE[contentType.toLowerCase()] ?? "bin";
}

const DATA_URI = /^data:([^;,]*)(;base64)?,([\s\S]*)$/;

function decodeDataUri(uri: string): { bytes: Uint8Array; contentType: string } {
  const match = DATA_URI.exec(uri);
  if (!match) throw new Error("Expected a data: URI.");

  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3];

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, contentType };
  }

  return {
    bytes: new TextEncoder().encode(decodeURIComponent(payload)),
    contentType,
  };
}

function toBytes(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/**
 * Upload one media item and record it in media_assets. Returns the stored path
 * plus a ~1h signed URL the caller can hand straight to a preview or an adapter.
 */
export async function uploadMedia(
  workspaceId: string,
  input: UploadMediaInput,
): Promise<UploadedMedia> {
  let bytes: Uint8Array;
  let contentType = input.contentType ?? "application/octet-stream";

  if (typeof input.data === "string") {
    const decoded = decodeDataUri(input.data);
    bytes = decoded.bytes;
    contentType = input.contentType ?? decoded.contentType;
  } else {
    bytes = toBytes(input.data);
  }

  const path = `${workspaceId}/${crypto.randomUUID()}.${extensionFor(contentType)}`;
  const db = service();

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadError) {
    throw new Error(`Media upload failed: ${uploadError.message}`);
  }

  const { data: inserted, error: insertError } = await db
    .from("media_assets")
    .insert({
      workspace_id: workspaceId,
      kind: input.kind,
      storage_path: path,
      width: input.width ?? null,
      height: input.height ?? null,
      duration_seconds: input.durationSeconds ?? null,
      byte_size: bytes.byteLength,
      alt_text: input.altText ?? null,
      ai_provider: input.ai?.provider ?? null,
      ai_model: input.ai?.model ?? null,
      ai_prompt: input.ai?.prompt ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    // Don't leave an orphan object behind a failed row insert.
    await db.storage.from(BUCKET).remove([path]);
    throw new Error("Couldn't record the uploaded media.");
  }

  const signedUrl = await signedUrlForPath(path);
  return {
    mediaId: (inserted as { id: string }).id,
    path,
    signedUrl,
    contentType,
    byteSize: bytes.byteLength,
  };
}

/** A fresh signed URL for a stored object — minted at publish time by the dispatcher. */
export async function signedUrlForPath(
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await service()
    .storage.from(BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) {
    throw new Error("Couldn't sign the media URL.");
  }
  return data.signedUrl;
}
