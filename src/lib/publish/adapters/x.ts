import "server-only";

import { MissingConfigError } from "@/lib/env";
import type { PlatformId } from "@/lib/platforms";
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
 * X (formerly Twitter) adapter — API v2, OAuth2 with PKCE.
 *
 * Connect is a confidential-client Authorization Code + PKCE flow: the browser
 * is sent to X's consent screen, the callback code is exchanged at the v2 token
 * endpoint (HTTP Basic client auth, since the paid app carries a secret) and the
 * account identity is read from /2/users/me. Publishing uploads each media item
 * through the chunked INIT → APPEND → FINALIZE dance to obtain media ids, then
 * posts /2/tweets. Every failure is mapped onto PublishResult — this module
 * never throws out of publish/refresh, so one bad tweet can't abort a batch.
 *
 * `offline.access` is what makes refresh possible; without it X issues an
 * access-only token and refresh() returns null so the account is asked to
 * reconnect rather than silently going stale.
 */

/** Pinned at design time. Each surface carries its own host. */
const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const USERS_ME_URL = "https://api.twitter.com/2/users/me";
const TWEETS_URL = "https://api.twitter.com/2/tweets";
/** v2 media upload; chunked command form. Requires the media.write scope. */
const MEDIA_UPLOAD_URL = "https://api.twitter.com/2/media/upload";

/** Documented limits, enforced here where they are stricter than platforms.ts. */
const MAX_TEXT = 280;
const MAX_IMAGES = 4;
const MAX_VIDEO_SECONDS = 140;
/** Chunk size for APPEND — comfortably under X's 5 MB per-segment ceiling. */
const APPEND_CHUNK_BYTES = 4 * 1024 * 1024;
/** How long to wait for async video/gif processing before giving up. */
const PROCESS_POLL_ATTEMPTS = 20;
const PROCESS_POLL_MS = 3_000;

const DEFAULT_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
  "media.write",
] as const;

interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

/**
 * Client credentials from the environment. Read lazily, like the rest of the
 * server config, so a missing secret only surfaces when a connect or publish
 * actually runs — never at import time.
 */
function oauthClient(): OAuthClient {
  const clientId = process.env.X_OAUTH_CLIENT_ID;
  const clientSecret = process.env.X_OAUTH_CLIENT_SECRET;
  const missing: string[] = [];
  if (!clientId) missing.push("X_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("X_OAUTH_CLIENT_SECRET");
  if (missing.length > 0) throw new MissingConfigError(missing);
  return { clientId: clientId!, clientSecret: clientSecret! };
}

function basicAuthHeader(client: OAuthClient): string {
  return `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}`;
}

/** Space-joined scope string, de-duplicated, defaults plus any caller extras. */
function scopeParam(extra?: readonly string[]): string {
  return Array.from(new Set([...DEFAULT_SCOPES, ...(extra ?? [])])).join(" ");
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

function tokenSetFromResponse(
  body: TokenResponse,
  fallbackRefresh: string | null,
): TokenSet {
  const scopes = body.scope
    ? body.scope.split(" ").filter(Boolean)
    : [...DEFAULT_SCOPES];
  return {
    accessToken: body.access_token ?? "",
    // X rotates the refresh token on every refresh; keep the prior one only if
    // the response omitted a new one.
    refreshToken: body.refresh_token ?? fallbackRefresh,
    tokenType: body.token_type ?? "bearer",
    expiresAt:
      typeof body.expires_in === "number"
        ? new Date(Date.now() + body.expires_in * 1_000)
        : null,
    scopes,
  };
}

/** POST the token endpoint with Basic client auth and a form body. */
async function tokenRequest(
  client: OAuthClient,
  form: Record<string, string>,
): Promise<Response> {
  return fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(client),
    },
    body: new URLSearchParams(form).toString(),
  });
}

// --- publish helpers --------------------------------------------------------

/** A safe, user-facing failure. Never carries a token or a raw upstream body. */
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

/** Thrown internally by the upload helpers; caught and mapped in publish(). */
class PublishError extends Error {
  constructor(
    message: string,
    readonly opts: { needsReconnect?: boolean; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "PublishError";
  }
}

/** Map an HTTP status to the retry/reconnect posture the dispatcher expects. */
function postureForStatus(status: number): {
  needsReconnect: boolean;
  retryable: boolean;
} {
  if (status === 401) return { needsReconnect: true, retryable: false };
  if (status === 429 || status >= 500)
    return { needsReconnect: false, retryable: true };
  return { needsReconnect: false, retryable: false };
}

function mediaCategory(media: PublishMedia): string {
  if (media.kind === "video") return "tweet_video";
  if (media.mimeType.toLowerCase() === "image/gif") return "tweet_gif";
  return "tweet_image";
}

/** Pull the media id out of either the v2 (`data.id`) or command (`media_id_string`) shape. */
function readMediaId(body: unknown): string | null {
  const b = body as {
    data?: { id?: string };
    media_id_string?: string;
    media_id?: number;
  };
  return b.data?.id ?? b.media_id_string ?? (b.media_id ? String(b.media_id) : null);
}

function readProcessingInfo(body: unknown): {
  state?: string;
  check_after_secs?: number;
} | null {
  const b = body as {
    data?: { processing_info?: { state?: string; check_after_secs?: number } };
    processing_info?: { state?: string; check_after_secs?: number };
  };
  return b.data?.processing_info ?? b.processing_info ?? null;
}

/** Fetch the stored object's bytes from its signed URL. */
async function fetchMediaBytes(
  media: PublishMedia,
  signal?: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const res = await fetch(media.url, { signal });
  if (!res.ok) {
    throw new PublishError("Couldn't read the attached media for upload.", {
      retryable: true,
    });
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Upload one item through INIT/APPEND/FINALIZE and return its media id. */
async function uploadMedia(
  accessToken: string,
  media: PublishMedia,
  signal?: AbortSignal,
): Promise<string> {
  const bytes = await fetchMediaBytes(media, signal);
  const auth = { Authorization: `Bearer ${accessToken}` };

  // INIT
  const initForm = new FormData();
  initForm.set("command", "INIT");
  initForm.set("total_bytes", String(bytes.byteLength));
  initForm.set("media_type", media.mimeType);
  initForm.set("media_category", mediaCategory(media));
  const initRes = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: auth,
    body: initForm,
    signal,
  });
  if (!initRes.ok) {
    throw new PublishError(
      "X rejected the media upload.",
      postureForStatus(initRes.status),
    );
  }
  const mediaId = readMediaId(await initRes.json().catch(() => ({})));
  if (!mediaId) {
    throw new PublishError("X didn't return a media id.", { retryable: true });
  }

  // APPEND — one segment per chunk.
  let segment = 0;
  for (let offset = 0; offset < bytes.byteLength; offset += APPEND_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + APPEND_CHUNK_BYTES);
    const appendForm = new FormData();
    appendForm.set("command", "APPEND");
    appendForm.set("media_id", mediaId);
    appendForm.set("segment_index", String(segment));
    appendForm.set("media", new Blob([chunk], { type: media.mimeType }));
    const appendRes = await fetch(MEDIA_UPLOAD_URL, {
      method: "POST",
      headers: auth,
      body: appendForm,
      signal,
    });
    if (!appendRes.ok) {
      throw new PublishError(
        "Uploading the media to X failed.",
        postureForStatus(appendRes.status),
      );
    }
    segment += 1;
  }

  // FINALIZE
  const finalizeForm = new FormData();
  finalizeForm.set("command", "FINALIZE");
  finalizeForm.set("media_id", mediaId);
  const finalizeRes = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: auth,
    body: finalizeForm,
    signal,
  });
  if (!finalizeRes.ok) {
    throw new PublishError(
      "X couldn't finalize the media upload.",
      postureForStatus(finalizeRes.status),
    );
  }

  await awaitProcessing(
    accessToken,
    mediaId,
    readProcessingInfo(await finalizeRes.json().catch(() => ({}))),
    signal,
  );
  return mediaId;
}

/** Poll STATUS until video/gif transcoding finishes; a no-op for still images. */
async function awaitProcessing(
  accessToken: string,
  mediaId: string,
  initial: { state?: string; check_after_secs?: number } | null,
  signal?: AbortSignal,
): Promise<void> {
  let info = initial;
  if (!info || info.state === "succeeded") return;

  for (let attempt = 0; attempt < PROCESS_POLL_ATTEMPTS; attempt++) {
    if (info?.state === "failed") {
      throw new PublishError("X couldn't process the uploaded media.");
    }
    if (info?.state === "succeeded") return;

    const waitMs = (info?.check_after_secs ?? PROCESS_POLL_MS / 1_000) * 1_000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    const url = `${MEDIA_UPLOAD_URL}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
    if (!res.ok) {
      throw new PublishError(
        "Couldn't check the media processing status on X.",
        postureForStatus(res.status),
      );
    }
    info = readProcessingInfo(await res.json().catch(() => ({})));
    if (!info) return; // No processing block means it's ready.
  }
  throw new PublishError("X is still processing the media — will retry.", {
    retryable: true,
  });
}

/**
 * Enforce the real X composition limits before spending an upload. Returns a
 * failure to surface, or null when the input is postable.
 */
function validate(input: PublishInput): Extract<PublishResult, { ok: false }> | null {
  const text = input.caption;
  if (text.length > MAX_TEXT) {
    return fail(`This post is over X's ${MAX_TEXT}-character limit.`);
  }

  const videos = input.media.filter((m) => m.kind === "video");
  const images = input.media.filter((m) => m.kind === "image");

  if (videos.length > 0) {
    if (input.media.length > 1) {
      return fail("X allows a single video with no other media on one post.");
    }
    const seconds = videos[0].durationSeconds ?? 0;
    if (seconds > MAX_VIDEO_SECONDS) {
      return fail(`X caps video at ${MAX_VIDEO_SECONDS}s.`);
    }
  } else if (images.length > MAX_IMAGES) {
    return fail(`X allows at most ${MAX_IMAGES} images per post.`);
  }

  if (text.length === 0 && input.media.length === 0) {
    return fail("Nothing to post — add text or media.");
  }
  return null;
}

function permalinkFor(handle: string, tweetId: string): string {
  return `https://x.com/${handle.replace(/^@/, "")}/status/${tweetId}`;
}

// --- adapter ----------------------------------------------------------------

export const xAdapter: PlatformAdapter = {
  platform: "x" satisfies PlatformId,
  defaultScopes: DEFAULT_SCOPES,
  supportsRefresh: true,

  authorizeUrl(params: AuthorizeParams): string {
    const { clientId } = oauthClient();
    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: params.redirectUri,
      scope: scopeParam(params.scopes),
      state: params.state,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
    });
    return `${AUTHORIZE_URL}?${query.toString()}`;
  },

  async exchangeCode(
    params: ExchangeParams,
  ): Promise<{ token: TokenSet; identity: RemoteIdentity }> {
    const client = oauthClient();
    const res = await tokenRequest(client, {
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
      client_id: client.clientId,
    });
    if (!res.ok) {
      throw new Error("X rejected the authorization code exchange.");
    }
    const token = tokenSetFromResponse(
      (await res.json()) as TokenResponse,
      null,
    );
    if (!token.accessToken) {
      throw new Error("X returned no access token.");
    }

    const identity = await resolveIdentity(token.accessToken);
    return { token, identity };
  },

  async refresh(token: TokenSet): Promise<TokenSet | null> {
    // offline.access was never granted, so there is nothing to refresh with.
    if (!token.refreshToken) return null;

    const client = oauthClient();
    const res = await tokenRequest(client, {
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: client.clientId,
    });
    // A rejected refresh (e.g. a revoked or rotated-out token) is the reconnect
    // signal — return null rather than throwing for that expected case.
    if (!res.ok) return null;

    const refreshed = tokenSetFromResponse(
      (await res.json()) as TokenResponse,
      token.refreshToken,
    );
    return refreshed.accessToken ? refreshed : null;
  },

  async publish(
    input: PublishInput,
    signal?: AbortSignal,
  ): Promise<PublishResult> {
    const invalid = validate(input);
    if (invalid) return invalid;

    try {
      const mediaIds: string[] = [];
      for (const item of input.media) {
        mediaIds.push(await uploadMedia(input.token.accessToken, item, signal));
      }

      const payload: {
        text?: string;
        media?: { media_ids: string[] };
      } = {};
      if (input.caption.length > 0) payload.text = input.caption;
      if (mediaIds.length > 0) payload.media = { media_ids: mediaIds };

      const res = await fetch(TWEETS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.token.accessToken}`,
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) {
        const posture = postureForStatus(res.status);
        return fail(messageForStatus(res.status), posture);
      }

      const body = (await res.json().catch(() => ({}))) as {
        data?: { id?: string };
      };
      const tweetId = body.data?.id;
      if (!tweetId) {
        return fail("X accepted the post but returned no id.", {
          retryable: true,
        });
      }
      return {
        ok: true,
        externalId: tweetId,
        permalink: permalinkFor(input.account.handle, tweetId),
      };
    } catch (error) {
      if (error instanceof PublishError) {
        return fail(error.message, error.opts);
      }
      // Network/abort and anything else unexpected: let the dispatcher retry.
      return fail("Publishing to X failed — will retry.", { retryable: true });
    }
  },
};

/** A user-facing message for a failed /2/tweets call, by status family. */
function messageForStatus(status: number): string {
  if (status === 401) return "X access has expired — reconnect the account.";
  if (status === 403)
    return "X refused this post — it may be a duplicate or breach a policy.";
  if (status === 429) return "X is rate-limiting posts right now.";
  if (status >= 500) return "X had a server error posting this.";
  return "X rejected this post.";
}

interface UsersMeResponse {
  data?: {
    id?: string;
    username?: string;
    name?: string;
    profile_image_url?: string;
  };
}

/** Resolve the connected account's identity from /2/users/me. */
async function resolveIdentity(accessToken: string): Promise<RemoteIdentity> {
  const url = `${USERS_ME_URL}?user.fields=profile_image_url`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Couldn't read the X account profile.");
  }
  const me = ((await res.json()) as UsersMeResponse).data;
  if (!me?.id || !me.username) {
    throw new Error("X returned an incomplete profile.");
  }
  return {
    externalId: me.id,
    handle: me.username,
    displayName: me.name ?? null,
    avatarUrl: me.profile_image_url ?? null,
    metadata: { username: me.username },
  };
}
