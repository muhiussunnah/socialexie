import "server-only";

import type { PlatformId } from "@/lib/platforms";
import { getPlatform } from "@/lib/platforms";
import { decryptToken, encryptToken } from "@/lib/publish/crypto";
import type {
  AuthorizeParams,
  ExchangeParams,
  PlatformAdapter,
  PublishInput,
  PublishMedia,
  PublishResult,
  RemoteIdentity,
  TokenSet,
} from "@/lib/publish/types";

/**
 * Meta adapter — Facebook Pages and Instagram Graph.
 *
 * Both networks sit behind the same Facebook Login, so one module serves them:
 * a shared OAuth core exchanges the code, upgrades to a long-lived user token
 * and reads the target Page (with its non-expiring Page token), then each
 * platform resolves its own identity and speaks its own publish dialect —
 * Facebook posts straight to the Page feed/photos/videos, Instagram runs the
 * two-step container→publish dance. Neither network refreshes; a lapsed
 * long-lived token is re-earned by reconnecting, so `supportsRefresh` is false.
 *
 * The Page access token is a credential, so it is never parked in
 * provider_metadata in the clear: it is sealed with the same AES-GCM envelope
 * the token store uses and only opened here at publish time.
 */

/** Pinned Graph version; bump deliberately when re-testing against a newer one. */
const API_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;
const DIALOG = `https://www.facebook.com/${API_VERSION}/dialog/oauth`;

const FACEBOOK_SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "business_management",
  "public_profile",
] as const;

const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
  "public_profile",
] as const;

/**
 * Instagram's Reels processing tops out well under the 900s the platform table
 * allows for feed video, so the adapter holds the real, stricter ceiling.
 */
const IG_REEL_MAX_SECONDS = 90;

/** Transient Graph error codes worth another attempt with backoff. */
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 341, 368, 613]);
/** Codes that mean the stored token can no longer be used — reconnect is the fix. */
const RECONNECT_CODES = new Set([102, 190]);

/** How long a container/video may process before a call gives up and retries. */
const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 3_000;

/* -------------------------------------------------------------------------
   Credentials + low-level Graph plumbing
   ------------------------------------------------------------------------- */

interface MetaCredentials {
  appId: string;
  appSecret: string;
}

/**
 * App id/secret as Worker secrets. Read directly from the environment — like
 * `site.ts` — so a missing value only bites the moment a connect or publish
 * runs, never at import time.
 */
function metaCredentials(): MetaCredentials {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Meta app credentials are not configured.");
  }
  return { appId, appSecret };
}

/** Graph's error envelope carries a numeric code we can classify without the body. */
class MetaApiError extends Error {
  readonly code: number | null;
  readonly subcode: number | null;
  readonly type: string | null;

  constructor(raw: unknown) {
    const err = asObj(raw) ?? {};
    super(asStr(err.message) ?? "Meta API error");
    this.name = "MetaApiError";
    this.code = asNum(err.code);
    this.subcode = asNum(err.error_subcode);
    this.type = asStr(err.type);
  }
}

function asStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function asNum(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
function asObj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
function asArr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Only forward defined values; `URLSearchParams` would stringify `undefined`. */
function form(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, value);
  }
  return search.toString();
}

async function graphRequest(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, signal, cache: "no-store" });
  const text = await response.text();

  let json: Record<string, unknown> = {};
  if (text) {
    try {
      json = asObj(JSON.parse(text)) ?? {};
    } catch {
      json = {};
    }
  }

  if (!response.ok || json.error) {
    throw new MetaApiError(json.error ?? { message: `HTTP ${response.status}` });
  }
  return json;
}

function graphGet(
  path: string,
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  return graphRequest(`${GRAPH}/${path}?${form(params)}`, { method: "GET" }, signal);
}

function graphPost(
  path: string,
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  return graphRequest(
    `${GRAPH}/${path}`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form(params),
    },
    signal,
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * Every failure the adapter surfaces to the dispatcher is a safe, fixed string —
 * never the raw upstream body, which could carry ids or a token in an odd error
 * path. The Graph code decides only whether to reconnect or retry.
 */
function classify(error: unknown): Extract<PublishResult, { ok: false }> {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      ok: false,
      error: "Publishing was interrupted — it will be retried.",
      needsReconnect: false,
      retryable: true,
    };
  }
  if (error instanceof MetaApiError) {
    if (
      (error.code !== null && RECONNECT_CODES.has(error.code)) ||
      (error.type === "OAuthException" && error.code === null)
    ) {
      return {
        ok: false,
        error: "This channel's access has expired — reconnect it.",
        needsReconnect: true,
        retryable: false,
      };
    }
    if (error.code !== null && RETRYABLE_CODES.has(error.code)) {
      return {
        ok: false,
        error: "The network is busy — this will be retried shortly.",
        needsReconnect: false,
        retryable: true,
      };
    }
    return {
      ok: false,
      error: "The network rejected this post.",
      needsReconnect: false,
      retryable: false,
    };
  }
  return {
    ok: false,
    error: "Publishing to this channel failed.",
    needsReconnect: false,
    retryable: true,
  };
}

/* -------------------------------------------------------------------------
   OAuth core (shared by both platforms)
   ------------------------------------------------------------------------- */

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>()]+/i;

function firstUrl(text: string): string | undefined {
  return URL_IN_TEXT.exec(text)?.[0];
}

interface PagePick {
  id: string;
  name: string;
  accessToken: string;
  avatarUrl: string | null;
}

/** Prefer a Page the user can actually post to; fall back to the first listed. */
function pickPage(pages: unknown[]): PagePick | null {
  const usable = pages.find((entry) => {
    const page = asObj(entry);
    const tasks = asArr(page?.tasks).filter((t): t is string => typeof t === "string");
    return tasks.includes("CREATE_CONTENT") || tasks.includes("MANAGE");
  });
  const chosen = asObj(usable ?? pages[0]);
  if (!chosen) return null;

  const id = asStr(chosen.id);
  const token = asStr(chosen.access_token);
  if (!id || !token) return null;

  const picture = asObj(asObj(chosen.picture)?.data);
  return {
    id,
    name: asStr(chosen.name) ?? id,
    accessToken: token,
    avatarUrl: asStr(picture?.url),
  };
}

async function exchangeMeta(
  platform: PlatformId,
  scopes: readonly string[],
  params: ExchangeParams,
): Promise<{ token: TokenSet; identity: RemoteIdentity }> {
  const { appId, appSecret } = metaCredentials();

  const shortLived = await graphGet("oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  });
  const shortToken = asStr(shortLived.access_token);
  if (!shortToken) throw new Error("Meta did not return an access token.");

  const longLived = await graphGet("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });
  const userToken = asStr(longLived.access_token);
  if (!userToken) throw new Error("Meta did not return a long-lived token.");
  const expiresIn = asNum(longLived.expires_in);

  const pagesResponse = await graphGet("me/accounts", {
    fields: "id,name,access_token,tasks,picture{url}",
    access_token: userToken,
  });
  const page = pickPage(asArr(pagesResponse.data));
  if (!page) {
    throw new Error(
      "No Facebook Page was found on this account. Create or get access to a Page, then reconnect.",
    );
  }

  const pageAccessTokenEnc = await encryptToken(page.accessToken);

  const token: TokenSet = {
    accessToken: userToken,
    refreshToken: null,
    tokenType: asStr(longLived.token_type) ?? "bearer",
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1_000) : null,
    scopes: [...scopes],
  };

  if (platform === "facebook") {
    return {
      token,
      identity: {
        externalId: page.id,
        handle: page.name,
        displayName: page.name,
        avatarUrl: page.avatarUrl,
        metadata: { pageId: page.id, pageAccessTokenEnc },
      },
    };
  }

  // Instagram: the IG business account hangs off the Page.
  const igResponse = await graphGet(page.id, {
    fields: "instagram_business_account{id,username,name,profile_picture_url}",
    access_token: page.accessToken,
  });
  const ig = asObj(igResponse.instagram_business_account);
  const igId = asStr(ig?.id);
  if (!igId) {
    throw new Error(
      "This Page has no linked Instagram business account. Link one in the Meta settings, then reconnect.",
    );
  }
  const username = asStr(ig?.username) ?? igId;

  return {
    token,
    identity: {
      externalId: igId,
      handle: username,
      displayName: asStr(ig?.name) ?? username,
      avatarUrl: asStr(ig?.profile_picture_url),
      metadata: { igUserId: igId, pageId: page.id, pageAccessTokenEnc },
    },
  };
}

/** Open the sealed Page token the exchange parked in provider_metadata. */
async function pageTokenFrom(
  account: RemoteIdentity,
): Promise<string | null> {
  const enc = asStr(account.metadata.pageAccessTokenEnc);
  if (!enc) return null;
  try {
    return await decryptToken(enc);
  } catch {
    return null;
  }
}

async function permalinkFor(
  objectId: string,
  token: string,
  field: "permalink_url" | "permalink",
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const data = await graphGet(objectId, { fields: field, access_token: token }, signal);
    return asStr(data[field]);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------
   Facebook publish
   ------------------------------------------------------------------------- */

async function publishFacebook(
  input: PublishInput,
  pageToken: string,
  signal?: AbortSignal,
): Promise<PublishResult> {
  const pageId = asStr(input.account.metadata.pageId);
  if (!pageId) {
    return {
      ok: false,
      error: "This channel needs reconnecting.",
      needsReconnect: true,
      retryable: false,
    };
  }

  const caption = input.caption.slice(0, getPlatform("facebook").captionLimit);
  const images = input.media.filter((m) => m.kind === "image");
  const video = input.media.find((m) => m.kind === "video");

  // Stories are their own endpoints with no feed post behind them.
  if (input.format === "story") {
    if (video) return publishFacebookVideoStory(pageId, pageToken, video, signal);
    if (images[0]) return publishFacebookPhotoStory(pageId, pageToken, images[0], signal);
    return textOnlyRejected("Stories");
  }

  if (video) {
    if (input.format === "reel") {
      return publishFacebookVideoSession(
        pageId,
        pageToken,
        "video_reels",
        video,
        caption,
        signal,
      );
    }
    const created = await graphPost(
      `${pageId}/videos`,
      { file_url: video.url, description: caption, access_token: pageToken },
      signal,
    );
    const id = asStr(created.id);
    if (!id) throw new MetaApiError({ message: "No video id returned." });
    return { ok: true, externalId: id, permalink: null };
  }

  if (images.length === 1) {
    const created = await graphPost(
      `${pageId}/photos`,
      { url: images[0].url, caption, access_token: pageToken },
      signal,
    );
    const postId = asStr(created.post_id) ?? asStr(created.id);
    if (!postId) throw new MetaApiError({ message: "No photo id returned." });
    return {
      ok: true,
      externalId: postId,
      permalink: await permalinkFor(postId, pageToken, "permalink_url", signal),
    };
  }

  if (images.length > 1) {
    // Upload each image unpublished, then attach them to one feed post.
    const attachments: Record<string, string> = {};
    for (let i = 0; i < images.length; i++) {
      const uploaded = await graphPost(
        `${pageId}/photos`,
        { url: images[i].url, published: "false", access_token: pageToken },
        signal,
      );
      const mediaId = asStr(uploaded.id);
      if (!mediaId) throw new MetaApiError({ message: "Photo upload failed." });
      attachments[`attached_media[${i}]`] = JSON.stringify({ media_fbid: mediaId });
    }
    const created = await graphPost(
      `${pageId}/feed`,
      { message: caption, access_token: pageToken, ...attachments },
      signal,
    );
    const id = asStr(created.id);
    if (!id) throw new MetaApiError({ message: "No post id returned." });
    return {
      ok: true,
      externalId: id,
      permalink: await permalinkFor(id, pageToken, "permalink_url", signal),
    };
  }

  // Text (optionally carrying a link).
  const created = await graphPost(
    `${pageId}/feed`,
    { message: caption, link: firstUrl(caption), access_token: pageToken },
    signal,
  );
  const id = asStr(created.id);
  if (!id) throw new MetaApiError({ message: "No post id returned." });
  return {
    ok: true,
    externalId: id,
    permalink: await permalinkFor(id, pageToken, "permalink_url", signal),
  };
}

/** Reels and video Stories share the start→upload→finish upload session. */
async function publishFacebookVideoSession(
  pageId: string,
  pageToken: string,
  endpoint: "video_reels" | "video_stories",
  video: PublishMedia,
  caption: string,
  signal?: AbortSignal,
): Promise<PublishResult> {
  const start = await graphPost(
    `${pageId}/${endpoint}`,
    { upload_phase: "start", access_token: pageToken },
    signal,
  );
  const videoId = asStr(start.video_id);
  const uploadUrl = asStr(start.upload_url);
  if (!videoId || !uploadUrl) {
    throw new MetaApiError({ message: "Could not start the upload session." });
  }

  // Hosted upload: Graph pulls the bytes from the signed URL for us.
  await graphRequest(
    uploadUrl,
    {
      method: "POST",
      headers: { Authorization: `OAuth ${pageToken}`, file_url: video.url },
    },
    signal,
  );

  await waitForVideoReady(videoId, pageToken, signal);

  const finishParams: Record<string, string | undefined> = {
    upload_phase: "finish",
    video_id: videoId,
    video_state: "PUBLISHED",
    access_token: pageToken,
  };
  if (endpoint === "video_reels") finishParams.description = caption;

  await graphPost(`${pageId}/${endpoint}`, finishParams, signal);
  return { ok: true, externalId: videoId, permalink: null };
}

async function waitForVideoReady(
  videoId: string,
  token: string,
  signal?: AbortSignal,
): Promise<void> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    const data = await graphGet(videoId, { fields: "status", access_token: token }, signal);
    const status = asObj(data.status);
    const processing = asStr(asObj(status?.processing_phase)?.status);
    const uploading = asStr(asObj(status?.uploading_phase)?.status);
    if (processing === "complete") return;
    if (processing === "error" || uploading === "error") {
      throw new MetaApiError({ message: "Video processing failed." });
    }
    await sleep(POLL_INTERVAL_MS, signal);
  }
  // Still encoding — let the dispatcher come back to it.
  throw new MetaApiError({ code: 2, message: "Video is still processing." });
}

async function publishFacebookPhotoStory(
  pageId: string,
  pageToken: string,
  image: PublishMedia,
  signal?: AbortSignal,
): Promise<PublishResult> {
  const uploaded = await graphPost(
    `${pageId}/photos`,
    { url: image.url, published: "false", access_token: pageToken },
    signal,
  );
  const photoId = asStr(uploaded.id);
  if (!photoId) throw new MetaApiError({ message: "Photo upload failed." });

  const created = await graphPost(
    `${pageId}/photo_stories`,
    { photo_id: photoId, access_token: pageToken },
    signal,
  );
  const id = asStr(created.post_id) ?? asStr(created.id) ?? photoId;
  return { ok: true, externalId: id, permalink: null };
}

function publishFacebookVideoStory(
  pageId: string,
  pageToken: string,
  video: PublishMedia,
  signal?: AbortSignal,
): Promise<PublishResult> {
  return publishFacebookVideoSession(
    pageId,
    pageToken,
    "video_stories",
    video,
    "",
    signal,
  );
}

function textOnlyRejected(what: string): PublishResult {
  return {
    ok: false,
    error: `${what} need a photo or video to publish.`,
    needsReconnect: false,
    retryable: false,
  };
}

/* -------------------------------------------------------------------------
   Instagram publish (container → poll → publish)
   ------------------------------------------------------------------------- */

async function publishInstagram(
  input: PublishInput,
  pageToken: string,
  signal?: AbortSignal,
): Promise<PublishResult> {
  const igUserId = asStr(input.account.metadata.igUserId);
  if (!igUserId) {
    return {
      ok: false,
      error: "This channel needs reconnecting.",
      needsReconnect: true,
      retryable: false,
    };
  }

  if (input.media.length === 0) {
    return {
      ok: false,
      error: "Instagram posts need a photo or video.",
      needsReconnect: false,
      retryable: false,
    };
  }

  const overLimit = input.media.find(
    (m) => m.kind === "video" && (m.durationSeconds ?? 0) > IG_REEL_MAX_SECONDS,
  );
  if (overLimit) {
    return {
      ok: false,
      error: `Instagram video must be ${IG_REEL_MAX_SECONDS} seconds or shorter.`,
      needsReconnect: false,
      retryable: false,
    };
  }

  const caption = input.caption.slice(0, getPlatform("instagram").captionLimit);

  let creationId: string;
  if (input.format === "carousel" || input.media.length > 1) {
    creationId = await buildCarousel(igUserId, pageToken, input.media, caption, signal);
  } else {
    const single = input.media[0];
    const type =
      input.format === "story"
        ? "STORIES"
        : single.kind === "video"
          ? "REELS"
          : "IMAGE";
    creationId = await createContainer(
      igUserId,
      pageToken,
      {
        media_type: type === "IMAGE" ? undefined : type,
        image_url: single.kind === "image" ? single.url : undefined,
        video_url: single.kind === "video" ? single.url : undefined,
        caption: type === "STORIES" ? undefined : caption,
      },
      signal,
    );
    await waitForContainer(creationId, pageToken, signal);
  }

  const published = await graphPost(
    `${igUserId}/media_publish`,
    { creation_id: creationId, access_token: pageToken },
    signal,
  );
  const id = asStr(published.id);
  if (!id) throw new MetaApiError({ message: "Publish returned no media id." });

  return {
    ok: true,
    externalId: id,
    permalink: await permalinkFor(id, pageToken, "permalink", signal),
  };
}

async function buildCarousel(
  igUserId: string,
  token: string,
  media: PublishMedia[],
  caption: string,
  signal?: AbortSignal,
): Promise<string> {
  const children: string[] = [];
  for (const item of media) {
    const childId = await createContainer(
      igUserId,
      token,
      {
        is_carousel_item: "true",
        media_type: item.kind === "video" ? "VIDEO" : undefined,
        image_url: item.kind === "image" ? item.url : undefined,
        video_url: item.kind === "video" ? item.url : undefined,
      },
      signal,
    );
    await waitForContainer(childId, token, signal);
    children.push(childId);
  }

  const parentId = await createContainer(
    igUserId,
    token,
    { media_type: "CAROUSEL", children: children.join(","), caption },
    signal,
  );
  await waitForContainer(parentId, token, signal);
  return parentId;
}

async function createContainer(
  igUserId: string,
  token: string,
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<string> {
  const created = await graphPost(
    `${igUserId}/media`,
    { ...params, access_token: token },
    signal,
  );
  const id = asStr(created.id);
  if (!id) throw new MetaApiError({ message: "Media container was not created." });
  return id;
}

async function waitForContainer(
  creationId: string,
  token: string,
  signal?: AbortSignal,
): Promise<void> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    const data = await graphGet(
      creationId,
      { fields: "status_code", access_token: token },
      signal,
    );
    const status = asStr(data.status_code);
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new MetaApiError({ message: "Media could not be processed." });
    }
    await sleep(POLL_INTERVAL_MS, signal);
  }
  // Still processing — retry the target rather than hang the whole run.
  throw new MetaApiError({ code: 2, message: "Media is still processing." });
}

/* -------------------------------------------------------------------------
   Adapter factory + exports
   ------------------------------------------------------------------------- */

function makeAdapter(
  platform: "facebook" | "instagram",
  scopes: readonly string[],
): PlatformAdapter {
  return {
    platform,
    defaultScopes: scopes,
    supportsRefresh: false,

    authorizeUrl(params: AuthorizeParams): string {
      const { appId } = metaCredentials();
      const scope = [...scopes, ...(params.scopes ?? [])].join(",");
      const query = new URLSearchParams({
        client_id: appId,
        redirect_uri: params.redirectUri,
        state: params.state,
        response_type: "code",
        scope,
      });
      return `${DIALOG}?${query.toString()}`;
    },

    exchangeCode(params: ExchangeParams) {
      return exchangeMeta(platform, scopes, params);
    },

    // Meta issues long-lived tokens with no refresh grant; reconnecting is the
    // documented path, so this reports "cannot refresh" per the contract.
    async refresh(): Promise<TokenSet | null> {
      return null;
    },

    async publish(input: PublishInput, signal?: AbortSignal): Promise<PublishResult> {
      try {
        const pageToken = await pageTokenFrom(input.account);
        if (!pageToken) {
          return {
            ok: false,
            error: "This channel needs reconnecting.",
            needsReconnect: true,
            retryable: false,
          };
        }
        return platform === "facebook"
          ? await publishFacebook(input, pageToken, signal)
          : await publishInstagram(input, pageToken, signal);
      } catch (error) {
        return classify(error);
      }
    },
  };
}

export const facebookAdapter = makeAdapter("facebook", FACEBOOK_SCOPES);
export const instagramAdapter = makeAdapter("instagram", INSTAGRAM_SCOPES);
