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
 * LinkedIn adapter — Posts API on member identities.
 *
 * The connect flow is a plain confidential-client authorization-code exchange
 * (LinkedIn is not a PKCE client, so the challenge the route mints is ignored),
 * identity comes from OpenID `/v2/userinfo`, and publishing translates a target
 * into LinkedIn's versioned REST dialect: initialize an upload, stream the bytes
 * to the returned URL, then create the post referencing the media urn. Every
 * failure is mapped onto PublishResult — nothing here throws out to the
 * dispatcher.
 */

/** Pinned REST version. Sent on every versioned call as `LinkedIn-Version`. */
const LINKEDIN_VERSION = "202401";

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const REST_BASE = "https://api.linkedin.com/rest";

/** Member post + the OpenID claims used to resolve the author identity. */
const DEFAULT_SCOPES = ["openid", "profile", "w_member_social"] as const;

/** LinkedIn caps commentary at 3,000 characters. */
const COMMENTARY_LIMIT = 3_000;

interface LinkedInCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Read the app credentials from the environment at call time. Kept local to the
 * adapter — the shared `env.ts` schema stays platform-agnostic — but it reuses
 * the same lazy, throw-on-first-use contract as the rest of the config layer.
 */
function credentials(): LinkedInCredentials {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  const missing: string[] = [];
  if (!clientId) missing.push("LINKEDIN_CLIENT_ID");
  if (!clientSecret) missing.push("LINKEDIN_CLIENT_SECRET");
  if (missing.length > 0) throw new MissingConfigError(missing);

  return { clientId: clientId as string, clientSecret: clientSecret as string };
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

/** now + `seconds`, or null when the network omits an expiry. */
function expiryFrom(seconds: number | undefined): Date | null {
  if (!seconds || Number.isNaN(seconds)) return null;
  return new Date(Date.now() + seconds * 1_000);
}

function tokenSetFrom(body: TokenResponse, fallbackScopes: string[]): TokenSet {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    tokenType: body.token_type ?? "Bearer",
    expiresAt: expiryFrom(body.expires_in),
    scopes: body.scope ? body.scope.split(/[\s,]+/).filter(Boolean) : fallbackScopes,
  };
}

interface UserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
}

/**
 * LinkedIn's commentary field is "Little Text": a small set of characters carry
 * annotation meaning and must be backslash-escaped to appear literally. Escape
 * the backslash first so the others aren't double-processed.
 */
function escapeCommentary(text: string): string {
  return text.replace(/[\\<>@[\]()*_~{}#|]/g, (ch) => `\\${ch}`);
}

/** The author urn resolved at connect time and parked in provider_metadata. */
function authorUrn(account: RemoteIdentity): string | null {
  const urn = account.metadata?.author;
  return typeof urn === "string" && urn.length > 0 ? urn : null;
}

/** A permalink for a freshly created share/ugcPost urn. */
function permalinkFor(postUrn: string): string {
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}`;
}

function versionedHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

/** Pull the media bytes down from the signed URL — LinkedIn has no fetch-by-URL. */
async function fetchBytes(
  media: PublishMedia,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const res = await fetch(media.url, { signal });
  if (!res.ok) throw new Error(`media fetch ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

interface UploadFailure {
  error: string;
  retryable: boolean;
  needsReconnect: boolean;
}

/** Map an upstream HTTP status onto the retry/reconnect contract. */
function classify(status: number): UploadFailure {
  if (status === 401) {
    return {
      error: "LinkedIn rejected the stored credentials — reconnect this channel.",
      retryable: false,
      needsReconnect: true,
    };
  }
  if (status === 403) {
    return {
      error:
        "LinkedIn denied this action. The connected member may be missing the required permission.",
      retryable: false,
      needsReconnect: false,
    };
  }
  if (status === 429 || status >= 500) {
    return {
      error: "LinkedIn is unavailable right now — this will be retried.",
      retryable: true,
      needsReconnect: false,
    };
  }
  return {
    error: "LinkedIn couldn't accept this post.",
    retryable: false,
    needsReconnect: false,
  };
}

/** A single-image upload: initialize, PUT the bytes, return the image urn. */
async function uploadImage(
  author: string,
  media: PublishMedia,
  token: TokenSet,
  signal?: AbortSignal,
): Promise<string> {
  const init = await fetch(`${REST_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: {
      ...versionedHeaders(token.accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    signal,
  });
  if (!init.ok) throw new UploadError(init.status);

  const value = ((await init.json()) as { value?: { uploadUrl?: string; image?: string } })
    .value;
  if (!value?.uploadUrl || !value.image) throw new UploadError(init.status);

  const bytes = await fetchBytes(media, signal);
  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": media.mimeType,
    },
    body: bytes as unknown as BodyInit,
    signal,
  });
  if (!put.ok) throw new UploadError(put.status);

  return value.image;
}

interface VideoInit {
  video: string;
  uploadToken: string;
  uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[];
}

/** A chunked video upload: initialize, PUT each part, finalize with the ETags. */
async function uploadVideo(
  author: string,
  media: PublishMedia,
  token: TokenSet,
  signal?: AbortSignal,
): Promise<string> {
  const bytes = await fetchBytes(media, signal);

  const init = await fetch(`${REST_BASE}/videos?action=initializeUpload`, {
    method: "POST",
    headers: {
      ...versionedHeaders(token.accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: author,
        fileSizeBytes: bytes.byteLength,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
    signal,
  });
  if (!init.ok) throw new UploadError(init.status);

  const value = ((await init.json()) as { value?: VideoInit }).value;
  if (!value?.video || !value.uploadToken || !value.uploadInstructions?.length) {
    throw new UploadError(init.status);
  }

  const partIds: string[] = [];
  for (const part of value.uploadInstructions) {
    const chunk = bytes.subarray(part.firstByte, part.lastByte + 1);
    const put = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: chunk as unknown as BodyInit,
      signal,
    });
    if (!put.ok) throw new UploadError(put.status);

    const etag = put.headers.get("etag");
    if (!etag) throw new UploadError(put.status);
    partIds.push(etag.replace(/"/g, ""));
  }

  const finalize = await fetch(`${REST_BASE}/videos?action=finalizeUpload`, {
    method: "POST",
    headers: {
      ...versionedHeaders(token.accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: value.video,
        uploadToken: value.uploadToken,
        uploadedPartIds: partIds,
      },
    }),
    signal,
  });
  if (!finalize.ok) throw new UploadError(finalize.status);

  return value.video;
}

/** Internal signal that carries an upstream status up to the publish mapper. */
class UploadError extends Error {
  constructor(readonly status: number) {
    super(`linkedin upload ${status}`);
    this.name = "UploadError";
  }
}

/** Build the `content` block for a post from its already-uploaded media urns. */
function contentFor(
  images: { id: string; altText: string | null }[],
  videoUrn: string | null,
): Record<string, unknown> | undefined {
  if (videoUrn) {
    return { media: { id: videoUrn } };
  }
  if (images.length === 1) {
    const only = images[0];
    return {
      media: only.altText
        ? { id: only.id, altText: only.altText }
        : { id: only.id },
    };
  }
  if (images.length > 1) {
    return {
      multiImage: {
        images: images.map((img) =>
          img.altText ? { id: img.id, altText: img.altText } : { id: img.id },
        ),
      },
    };
  }
  return undefined;
}

class LinkedInAdapter implements PlatformAdapter {
  readonly platform: PlatformId = "linkedin";
  readonly defaultScopes = DEFAULT_SCOPES;
  readonly supportsRefresh = true;

  authorizeUrl(params: AuthorizeParams): string {
    const { clientId } = credentials();
    const scopes = [...DEFAULT_SCOPES, ...(params.scopes ?? [])];
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("state", params.state);
    url.searchParams.set("scope", Array.from(new Set(scopes)).join(" "));
    return url.toString();
  }

  async exchangeCode(
    params: ExchangeParams,
  ): Promise<{ token: TokenSet; identity: RemoteIdentity }> {
    const { clientId, clientSecret } = credentials();

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`LinkedIn token exchange failed (${res.status}).`);
    }

    const token = tokenSetFrom((await res.json()) as TokenResponse, [
      ...DEFAULT_SCOPES,
    ]);
    const identity = await this.resolveIdentity(token.accessToken);
    return { token, identity };
  }

  async refresh(token: TokenSet): Promise<TokenSet | null> {
    // Refresh tokens are only issued to approved apps; without one the member
    // must reconnect, which the null return signals to the token store.
    if (!token.refreshToken) return null;

    const { clientId, clientSecret } = credentials();
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) return null;

    const body = (await res.json()) as TokenResponse;
    const refreshed = tokenSetFrom(body, token.scopes);
    // LinkedIn rotates the refresh token only sometimes — keep the old one when
    // the response carries none, so the account stays refreshable.
    if (!refreshed.refreshToken) refreshed.refreshToken = token.refreshToken;
    return refreshed;
  }

  async publish(input: PublishInput, signal?: AbortSignal): Promise<PublishResult> {
    const author = authorUrn(input.account);
    if (!author) {
      return {
        ok: false,
        error: "This LinkedIn channel is missing its author identity — reconnect it.",
        needsReconnect: true,
        retryable: false,
      };
    }

    const commentary = input.caption.trim();
    if (commentary.length > COMMENTARY_LIMIT) {
      return {
        ok: false,
        error: `LinkedIn posts are limited to ${COMMENTARY_LIMIT} characters.`,
        needsReconnect: false,
        retryable: false,
      };
    }

    const images = input.media.filter((m) => m.kind === "image");
    const videos = input.media.filter((m) => m.kind === "video");
    if (videos.length > 1) {
      return {
        ok: false,
        error: "LinkedIn accepts a single video per post.",
        needsReconnect: false,
        retryable: false,
      };
    }
    if (videos.length > 0 && images.length > 0) {
      return {
        ok: false,
        error: "LinkedIn can't mix a video and images in one post.",
        needsReconnect: false,
        retryable: false,
      };
    }

    let content: Record<string, unknown> | undefined;
    try {
      if (videos.length === 1) {
        const videoUrn = await uploadVideo(author, videos[0], input.token, signal);
        content = contentFor([], videoUrn);
      } else if (images.length > 0) {
        const uploaded: { id: string; altText: string | null }[] = [];
        for (const image of images) {
          const id = await uploadImage(author, image, input.token, signal);
          uploaded.push({ id, altText: image.altText });
        }
        content = contentFor(uploaded, null);
      }
    } catch (err) {
      if (err instanceof UploadError) {
        const failure = classify(err.status);
        return { ok: false, ...failure };
      }
      return {
        ok: false,
        error: "Couldn't upload the media to LinkedIn — this will be retried.",
        needsReconnect: false,
        retryable: true,
      };
    }

    const body: Record<string, unknown> = {
      author,
      commentary: escapeCommentary(commentary),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };
    if (content) body.content = content;

    let res: Response;
    try {
      res = await fetch(`${REST_BASE}/posts`, {
        method: "POST",
        headers: {
          ...versionedHeaders(input.token.accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      return {
        ok: false,
        error: "Couldn't reach LinkedIn — this will be retried.",
        needsReconnect: false,
        retryable: true,
      };
    }

    if (!res.ok) {
      const failure = classify(res.status);
      return { ok: false, ...failure };
    }

    // The created post urn comes back in a response header, not the body.
    const postUrn =
      res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id");
    if (!postUrn) {
      return {
        ok: false,
        error: "LinkedIn accepted the post but returned no id.",
        needsReconnect: false,
        retryable: false,
      };
    }

    return { ok: true, externalId: postUrn, permalink: permalinkFor(postUrn) };
  }

  /** Resolve the connected member from the OpenID userinfo endpoint. */
  private async resolveIdentity(accessToken: string): Promise<RemoteIdentity> {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`LinkedIn identity lookup failed (${res.status}).`);
    }

    const info = (await res.json()) as UserInfo;
    const displayName =
      info.name ??
      [info.given_name, info.family_name].filter(Boolean).join(" ") ??
      null;

    return {
      externalId: info.sub,
      handle: info.email ?? displayName ?? info.sub,
      displayName: displayName || null,
      avatarUrl: info.picture ?? null,
      metadata: { author: `urn:li:person:${info.sub}` },
    };
  }
}

export const linkedinAdapter: PlatformAdapter = new LinkedInAdapter();
