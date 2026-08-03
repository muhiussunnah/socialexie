import "server-only";

import type { PlatformId } from "@/lib/platforms";
import { getPlatform } from "@/lib/platforms";
import type {
  AuthorizeParams,
  ExchangeParams,
  PlatformAdapter,
  PublishInput,
  PublishResult,
  RemoteIdentity,
  TokenSet,
} from "@/lib/publish/types";

/**
 * TikTok adapter — Content Posting API.
 *
 * OAuth is v2 authorization-code with PKCE (the route mints state + verifier);
 * tokens come from open.tiktokapis.com and do refresh. Publishing is TikTok's
 * two-step async dance: initialise a PULL_FROM_URL upload (video/init or, for
 * image posts, content/init), then poll status/fetch until the post lands. The
 * network fetches the bytes itself from the signed Storage URL, so nothing is
 * streamed through the Worker.
 *
 * The interface hands us one publish() call and expects one terminal result, so
 * the status poll runs inline here rather than parking publish_id across cron
 * ticks. Direct-post is only granted to audited apps: an unaudited client can
 * publish to SELF_ONLY (the creator's private drafts) at best, and any stricter
 * refusal from the network is surfaced as a clear, non-retryable error.
 */

const PLATFORM: PlatformId = "tiktok";

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const API_BASE = "https://open.tiktokapis.com/v2";

/** Basic identity + both publish surfaces. Photo scopes ride the same connect. */
const DEFAULT_SCOPES = [
  "user.info.basic",
  "video.publish",
  "video.upload",
] as const;

/** How long to wait for TikTok to pull + process the media before giving up. */
const STATUS_POLL_ATTEMPTS = 15;
const STATUS_POLL_INTERVAL_MS = 4_000;

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  open_id?: string;
  error?: string;
  error_description?: string;
}

interface UserInfoResponse {
  data?: {
    user?: {
      open_id?: string;
      union_id?: string;
      display_name?: string;
      avatar_url?: string;
    };
  };
  error?: { code?: string; message?: string };
}

interface CreatorInfoResponse {
  data?: {
    privacy_level_options?: string[];
    max_video_post_duration_sec?: number;
    comment_disabled?: boolean;
    duet_disabled?: boolean;
    stitch_disabled?: boolean;
  };
  error?: { code?: string; message?: string };
}

interface InitResponse {
  data?: { publish_id?: string };
  error?: { code?: string; message?: string };
}

interface StatusResponse {
  data?: {
    status?: string;
    fail_reason?: string;
    publicaly_available_post_id?: string[];
    publicly_available_post_id?: string[];
  };
  error?: { code?: string; message?: string };
}

function clientCredentials(): { clientKey: string; clientSecret: string } {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error(
      "Missing environment configuration: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.",
    );
  }
  return { clientKey, clientSecret };
}

function ok<T extends { ok: true }>(value: Omit<T, "ok">): PublishResult {
  return { ok: true, ...(value as object) } as PublishResult;
}

function fail(
  error: string,
  opts: { needsReconnect?: boolean; retryable?: boolean } = {},
): Extract<PublishResult, { ok: false }> {
  return {
    ok: false,
    error,
    needsReconnect: opts.needsReconnect ?? false,
    retryable: opts.retryable ?? false,
  };
}

/** TikTok's OAuth-token errors that mean the connection itself is unusable. */
function isAuthError(code: string | undefined): boolean {
  if (!code) return false;
  return (
    code === "access_token_invalid" ||
    code === "access_token_expired" ||
    code === "scope_not_authorized" ||
    code === "scope_permission_missed"
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export const tiktokAdapter: PlatformAdapter = {
  platform: PLATFORM,
  defaultScopes: DEFAULT_SCOPES,
  supportsRefresh: true,

  authorizeUrl(params: AuthorizeParams): string {
    const { clientKey } = clientCredentials();
    const scopes =
      params.scopes && params.scopes.length > 0
        ? params.scopes
        : DEFAULT_SCOPES;

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("state", params.state);
    // PKCE is mandatory on TikTok's web authorize flow.
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  },

  async exchangeCode(
    params: ExchangeParams,
  ): Promise<{ token: TokenSet; identity: RemoteIdentity }> {
    const { clientKey, clientSecret } = clientCredentials();

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await response.json().catch(() => ({}))) as TokenResponse;

    if (!response.ok || payload.error || !payload.access_token) {
      throw new Error(
        payload.error_description ??
          payload.error ??
          "TikTok rejected the authorization code.",
      );
    }

    const token = tokenFromResponse(payload);
    const identity = await resolveIdentity(token.accessToken, payload.open_id);
    return { token, identity };
  },

  async refresh(token: TokenSet): Promise<TokenSet | null> {
    if (!token.refreshToken) return null;
    const { clientKey, clientSecret } = clientCredentials();

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await response.json().catch(() => ({}))) as TokenResponse;

    if (!response.ok || payload.error || !payload.access_token) {
      // A revoked / expired refresh token is unrecoverable — signal reconnect.
      return null;
    }

    const next = tokenFromResponse(payload);
    // TikTok rotates refresh tokens; keep the prior one only if none came back.
    if (!next.refreshToken) next.refreshToken = token.refreshToken;
    if (next.scopes.length === 0) next.scopes = token.scopes;
    return next;
  },

  async publish(
    input: PublishInput,
    signal?: AbortSignal,
  ): Promise<PublishResult> {
    if (input.media.length === 0) {
      return fail("TikTok posts need a video or images attached.");
    }

    const hasVideo = input.media.some((m) => m.kind === "video");
    try {
      return hasVideo
        ? await publishVideo(input, signal)
        : await publishPhotos(input, signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return fail("Publishing was interrupted.", { retryable: true });
      }
      // Network/parse faults are transient from our side — let the cron retry.
      return fail("Couldn't reach TikTok — we'll try again shortly.", {
        retryable: true,
      });
    }
  },
};

function tokenFromResponse(payload: TokenResponse): TokenSet {
  const expiresAt =
    typeof payload.expires_in === "number"
      ? new Date(Date.now() + payload.expires_in * 1_000)
      : null;
  return {
    accessToken: payload.access_token as string,
    refreshToken: payload.refresh_token ?? null,
    tokenType: payload.token_type ?? "Bearer",
    expiresAt,
    scopes: payload.scope ? payload.scope.split(",").filter(Boolean) : [],
  };
}

/** Read the connected creator so social_accounts has a name + avatar to show. */
async function resolveIdentity(
  accessToken: string,
  openIdHint: string | undefined,
): Promise<RemoteIdentity> {
  const url = new URL(`${API_BASE}/user/info/`);
  url.searchParams.set(
    "fields",
    "open_id,union_id,display_name,avatar_url",
  );

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => ({}))) as UserInfoResponse;
  const user = payload.data?.user ?? {};

  const externalId = user.open_id ?? openIdHint ?? "";
  const displayName = user.display_name ?? null;
  return {
    externalId,
    handle: displayName ?? externalId,
    displayName,
    avatarUrl: user.avatar_url ?? null,
    metadata: {
      open_id: externalId,
      union_id: user.union_id ?? null,
    },
  };
}

/** Bearer POST to a Content Posting endpoint, returning the parsed envelope. */
async function apiPost<T>(
  path: string,
  accessToken: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ status: number; payload: T }> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as T;
  return { status: response.status, payload };
}

/**
 * Ask the creator-info endpoint which privacy levels this account+app may use.
 * It doubles as the audit gate: an unaudited app gets SELF_ONLY only, so this is
 * where we discover the real ceiling instead of guessing.
 */
async function pickPrivacyLevel(
  accessToken: string,
  signal?: AbortSignal,
): Promise<
  | { ok: true; level: string; maxDurationSec: number | null }
  | { ok: false; result: Extract<PublishResult, { ok: false }> }
> {
  const { status, payload } = await apiPost<CreatorInfoResponse>(
    "/post/publish/creator_info/query/",
    accessToken,
    {},
    signal,
  );

  const code = payload.error?.code;
  if (code && code !== "ok") {
    if (isAuthError(code)) {
      return {
        ok: false,
        result: fail("Reconnect your TikTok account to keep publishing.", {
          needsReconnect: true,
        }),
      };
    }
    if (status === 429) {
      return {
        ok: false,
        result: fail("TikTok is rate-limiting us — we'll retry shortly.", {
          retryable: true,
        }),
      };
    }
    return {
      ok: false,
      result: fail(
        "TikTok wouldn't confirm this account can post right now.",
        { retryable: status >= 500 },
      ),
    };
  }

  const options = payload.data?.privacy_level_options ?? [];
  if (options.length === 0) {
    return {
      ok: false,
      result: fail(
        "This TikTok app isn't approved for direct posting yet — TikTok requires an audited app before posts can go public.",
      ),
    };
  }

  // Prefer a public post; fall back to whatever the account is cleared for
  // (an unaudited app will only ever offer SELF_ONLY here).
  const level = options.includes("PUBLIC_TO_EVERYONE")
    ? "PUBLIC_TO_EVERYONE"
    : options[0];
  return {
    ok: true,
    level,
    maxDurationSec: payload.data?.max_video_post_duration_sec ?? null,
  };
}

async function publishVideo(
  input: PublishInput,
  signal?: AbortSignal,
): Promise<PublishResult> {
  const video = input.media.find((m) => m.kind === "video");
  if (!video) return fail("No video was attached to this TikTok post.");

  const spec = getPlatform(PLATFORM);
  const bounds = spec.video;
  const duration = video.durationSeconds;
  if (bounds && duration !== null) {
    if (duration < bounds.minSeconds) {
      return fail(`TikTok videos must run at least ${bounds.minSeconds}s.`);
    }
    if (duration > bounds.maxSeconds) {
      return fail(`TikTok videos can't be longer than ${bounds.maxSeconds}s.`);
    }
  }

  const privacy = await pickPrivacyLevel(input.token.accessToken, signal);
  if (!privacy.ok) return privacy.result;

  // The network-reported ceiling is authoritative when it's stricter than ours.
  if (
    privacy.maxDurationSec !== null &&
    duration !== null &&
    duration > privacy.maxDurationSec
  ) {
    return fail(
      `This account can only post TikTok videos up to ${privacy.maxDurationSec}s.`,
    );
  }

  const initBody = {
    post_info: {
      title: captionFor(input, spec.captionLimit),
      privacy_level: privacy.level,
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1_000,
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: video.url,
    },
  };

  const { status, payload } = await apiPost<InitResponse>(
    "/post/publish/video/init/",
    input.token.accessToken,
    initBody,
    signal,
  );

  const initError = mapInitError(status, payload.error, "video_url");
  if (initError) return initError;

  const publishId = payload.data?.publish_id;
  if (!publishId) {
    return fail("TikTok didn't return an upload id.", { retryable: true });
  }

  return awaitCompletion(input, publishId, signal);
}

async function publishPhotos(
  input: PublishInput,
  signal?: AbortSignal,
): Promise<PublishResult> {
  const spec = getPlatform(PLATFORM);
  const images = input.media
    .filter((m) => m.kind === "image")
    .map((m) => m.url);
  if (images.length === 0) {
    return fail("No images were attached to this TikTok post.");
  }
  if (images.length > spec.maxMedia) {
    return fail(`TikTok photo posts allow up to ${spec.maxMedia} images.`);
  }

  const privacy = await pickPrivacyLevel(input.token.accessToken, signal);
  if (!privacy.ok) return privacy.result;

  const title = input.title?.trim() || firstLine(input.caption);
  const initBody = {
    post_info: {
      title: title.slice(0, spec.captionLimit),
      description: captionFor(input, spec.captionLimit),
      privacy_level: privacy.level,
      disable_comment: false,
      auto_add_music: true,
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_cover_index: 0,
      photo_images: images,
    },
    post_mode: "DIRECT_POST",
    media_type: "PHOTO",
  };

  const { status, payload } = await apiPost<InitResponse>(
    "/post/publish/content/init/",
    input.token.accessToken,
    initBody,
    signal,
  );

  const initError = mapInitError(status, payload.error, "photo_images");
  if (initError) return initError;

  const publishId = payload.data?.publish_id;
  if (!publishId) {
    return fail("TikTok didn't return an upload id.", { retryable: true });
  }

  return awaitCompletion(input, publishId, signal);
}

/** Map an init-call failure onto a user-facing result, or null when it succeeded. */
function mapInitError(
  status: number,
  error: { code?: string; message?: string } | undefined,
  urlField: string,
): Extract<PublishResult, { ok: false }> | null {
  const code = error?.code;
  if (!code || code === "ok") return null;

  if (isAuthError(code)) {
    return fail("Reconnect your TikTok account to keep publishing.", {
      needsReconnect: true,
    });
  }
  if (code === "rate_limit_exceeded" || status === 429) {
    return fail("TikTok is rate-limiting us — we'll retry shortly.", {
      retryable: true,
    });
  }
  if (code === "url_ownership_unverified") {
    return fail(
      "TikTok won't pull media from an unverified domain — verify the app's URL prefix in the TikTok developer portal.",
    );
  }
  if (code === "invalid_param" || code === "file_format_check_failed") {
    return fail(`TikTok rejected the ${urlField} — check the media meets its specs.`);
  }
  if (code === "spam_risk_too_many_posts" || code === "spam_risk_user_banned_from_posting") {
    return fail("TikTok is temporarily blocking new posts on this account.");
  }
  if (status >= 500) {
    return fail("TikTok had a server error — we'll try again.", {
      retryable: true,
    });
  }
  return fail("TikTok wouldn't accept this post.");
}

/**
 * Poll status/fetch until the post completes, fails, or we run out of patience.
 * A still-processing post at the end is returned as retryable so a later tick
 * gives the network more time rather than the target being marked failed.
 */
async function awaitCompletion(
  input: PublishInput,
  publishId: string,
  signal?: AbortSignal,
): Promise<PublishResult> {
  for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
    await sleep(STATUS_POLL_INTERVAL_MS, signal);

    const { status, payload } = await apiPost<StatusResponse>(
      "/post/publish/status/fetch/",
      input.token.accessToken,
      { publish_id: publishId },
      signal,
    );

    const code = payload.error?.code;
    if (code && code !== "ok") {
      if (isAuthError(code)) {
        return fail("Reconnect your TikTok account to keep publishing.", {
          needsReconnect: true,
        });
      }
      if (status >= 500 || status === 429) continue;
      return fail("TikTok couldn't confirm the post status.");
    }

    const state = payload.data?.status;
    if (state === "PUBLISH_COMPLETE") {
      const postId =
        payload.data?.publicaly_available_post_id?.[0] ??
        payload.data?.publicly_available_post_id?.[0] ??
        publishId;
      return ok<{ ok: true; externalId: string; permalink: string | null }>({
        externalId: postId,
        permalink: permalinkFor(input.account, postId),
      });
    }
    if (state === "FAILED") {
      return fail("TikTok failed to process this post.");
    }
    // PROCESSING_UPLOAD / PROCESSING_DOWNLOAD / SEND_TO_USER_INBOX → keep waiting.
  }

  return fail("TikTok is still processing this post — we'll check again soon.", {
    retryable: true,
  });
}

/** A watch URL when the account's username is known; TikTok gives no permalink. */
function permalinkFor(account: RemoteIdentity, postId: string): string | null {
  const username =
    typeof account.metadata.username === "string"
      ? account.metadata.username
      : null;
  if (!username) return null;
  return `https://www.tiktok.com/@${username}/video/${postId}`;
}

function captionFor(input: PublishInput, limit: number): string {
  return input.caption.slice(0, limit);
}

function firstLine(text: string): string {
  const line = text.split("\n", 1)[0]?.trim() ?? "";
  return line.length > 0 ? line : "Untitled";
}
