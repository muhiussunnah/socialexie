import "server-only";

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
 * YouTube (Data API v3).
 *
 * Google speaks plain OAuth2 with PKCE, but two of its habits shape this file:
 * a refresh token only ever arrives when the consent URL carries
 * `access_type=offline` *and* `prompt=consent`, and the upload is resumable —
 * you open a session against one endpoint, then stream the bytes to the session
 * URI it hands back. There is no pull-from-URL path, so the adapter fetches the
 * signed media URL itself and pipes the body straight into the PUT.
 */

const AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const RESUMABLE_UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/youtube/v3/videos";
const CHANNELS_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";

/** Upload is what we ask for; readonly only resolves the channel for identity. */
const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
] as const;

/** YouTube caps the title at 100 chars and the description at 5000. */
const TITLE_MAX = 100;
const DESCRIPTION_MAX = 5_000;
/** Vertical clips at or under this many seconds qualify as a Short. */
const SHORT_MAX_SECONDS = 60;
const SHORTS_TAG = "#Shorts";

interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

/**
 * The Google OAuth client is read from the Worker environment at call time, in
 * keeping with the lazy validation in `env.ts` — a missing secret only surfaces
 * when a connect or refresh actually runs, never at import.
 */
function oauthClient(): OAuthClient {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET. Set both as Worker secrets.",
    );
  }
  return { clientId, clientSecret };
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function tokenSetFrom(
  body: GoogleTokenResponse,
  fallbackRefresh: string | null,
  fallbackScopes: string[],
): TokenSet {
  const expiresAt =
    typeof body.expires_in === "number"
      ? new Date(Date.now() + body.expires_in * 1_000)
      : null;
  return {
    accessToken: body.access_token ?? "",
    // Google omits the refresh token on refresh responses; keep the stored one.
    refreshToken: body.refresh_token ?? fallbackRefresh,
    tokenType: body.token_type ?? "Bearer",
    expiresAt,
    scopes: body.scope ? body.scope.split(" ").filter(Boolean) : fallbackScopes,
  };
}

interface ChannelListResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      customUrl?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
  }>;
}

/** Pick the crispest thumbnail YouTube offers for the connected channel. */
function avatarFrom(
  thumbnails: Record<string, { url?: string }> | undefined,
): string | null {
  if (!thumbnails) return null;
  return (
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    null
  );
}

/** The first non-empty line of the caption, clipped to YouTube's title ceiling. */
function deriveTitle(caption: string): string {
  const firstLine = caption
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const base = (firstLine ?? "Untitled").slice(0, TITLE_MAX);
  return base.length > 0 ? base : "Untitled";
}

/** The single video this post carries, or null when there isn't exactly one. */
function soleVideo(media: PublishMedia[]): PublishMedia | null {
  const videos = media.filter((item) => item.kind === "video");
  if (videos.length !== 1) return null;
  return videos[0];
}

interface VideoSnippet {
  title: string;
  description: string;
  categoryId: string;
}

/**
 * Assemble the video metadata. Shorts need `#Shorts` somewhere in the title or
 * description to be classified as one, so it is appended to the description when
 * the clip qualifies and the tag isn't already present.
 */
function buildSnippet(input: PublishInput, video: PublishMedia): VideoSnippet {
  const title = (input.title?.trim() || deriveTitle(input.caption)).slice(
    0,
    TITLE_MAX,
  );

  let description = input.caption.slice(0, DESCRIPTION_MAX);

  const isShort =
    (input.format === "short" || input.format === "reel") &&
    video.durationSeconds !== null &&
    video.durationSeconds <= SHORT_MAX_SECONDS;

  const alreadyTagged = /#shorts\b/i.test(`${title}\n${description}`);
  if (isShort && !alreadyTagged) {
    const suffix = description.length > 0 ? `\n\n${SHORTS_TAG}` : SHORTS_TAG;
    description = `${description}${suffix}`.slice(0, DESCRIPTION_MAX);
  }

  return { title, description, categoryId: "22" };
}

type StreamingInit = RequestInit & { duplex?: "half" };

class YouTubeAdapter implements PlatformAdapter {
  readonly platform: PlatformId = "youtube";
  readonly defaultScopes = DEFAULT_SCOPES;
  readonly supportsRefresh = true;

  authorizeUrl(params: AuthorizeParams): string {
    const { clientId } = oauthClient();
    const scopes = [
      ...DEFAULT_SCOPES,
      ...(params.scopes ?? []),
    ];

    const url = new URL(AUTHORIZE_ENDPOINT);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", Array.from(new Set(scopes)).join(" "));
    // Both are mandatory to actually receive a refresh token from Google.
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", params.state);
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCode(
    params: ExchangeParams,
  ): Promise<{ token: TokenSet; identity: RemoteIdentity }> {
    const { clientId, clientSecret } = oauthClient();

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: params.codeVerifier,
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });

    const body = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
    if (!response.ok || !body.access_token) {
      throw new Error(
        body.error_description || body.error || "Google rejected the sign-in.",
      );
    }

    const token = tokenSetFrom(body, null, [...DEFAULT_SCOPES]);
    const identity = await this.resolveIdentity(token.accessToken);
    return { token, identity };
  }

  async refresh(token: TokenSet): Promise<TokenSet | null> {
    if (!token.refreshToken) return null;
    const { clientId, clientSecret } = oauthClient();

    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });

    const body = (await response.json().catch(() => ({}))) as GoogleTokenResponse;

    // A revoked or expired grant is terminal: null tells the store to prompt a
    // reconnect rather than retry a refresh that can never succeed.
    if (body.error === "invalid_grant") return null;
    if (!response.ok || !body.access_token) {
      throw new Error(
        body.error_description || body.error || "Couldn't refresh the token.",
      );
    }

    return tokenSetFrom(body, token.refreshToken, token.scopes);
  }

  async publish(
    input: PublishInput,
    signal?: AbortSignal,
  ): Promise<PublishResult> {
    const video = soleVideo(input.media);
    if (!video) {
      return {
        ok: false,
        error: "YouTube posts need exactly one video.",
        needsReconnect: false,
        retryable: false,
      };
    }

    const snippet = buildSnippet(input, video);

    try {
      const sessionUri = await this.openUploadSession(
        input.token.accessToken,
        snippet,
        video,
        signal,
      );
      if (sessionUri.ok === false) return sessionUri.result;

      return await this.streamVideo(
        input.token.accessToken,
        sessionUri.uri,
        video,
        signal,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          ok: false,
          error: "Upload was interrupted — it will be retried.",
          needsReconnect: false,
          retryable: true,
        };
      }
      return {
        ok: false,
        error: "Couldn't reach YouTube — it will be retried.",
        needsReconnect: false,
        retryable: true,
      };
    }
  }

  /* ---------------------------------------------------------------------- */

  /** Resolve the connected channel so social_accounts can address it later. */
  private async resolveIdentity(accessToken: string): Promise<RemoteIdentity> {
    const url = new URL(CHANNELS_ENDPOINT);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("mine", "true");

    const response = await fetch(url.toString(), {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Couldn't read the YouTube channel.");
    }

    const body = (await response.json()) as ChannelListResponse;
    const channel = body.items?.[0];
    if (!channel?.id) {
      throw new Error("This Google account has no YouTube channel.");
    }

    const snippet = channel.snippet ?? {};
    const handle = snippet.customUrl || snippet.title || channel.id;
    return {
      externalId: channel.id,
      handle,
      displayName: snippet.title ?? null,
      avatarUrl: avatarFrom(snippet.thumbnails),
      metadata: { channelId: channel.id },
    };
  }

  /**
   * Start the resumable upload. Returns the session URI on success, or a mapped
   * PublishResult when Google refuses the metadata (auth, quota, bad request).
   */
  private async openUploadSession(
    accessToken: string,
    snippet: VideoSnippet,
    video: PublishMedia,
    signal?: AbortSignal,
  ): Promise<{ ok: true; uri: string } | { ok: false; result: PublishResult }> {
    const url = new URL(RESUMABLE_UPLOAD_ENDPOINT);
    url.searchParams.set("uploadType", "resumable");
    url.searchParams.set("part", "snippet,status");

    const metadata = {
      snippet: {
        title: snippet.title,
        description: snippet.description,
        categoryId: snippet.categoryId,
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    };

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": video.mimeType || "video/mp4",
        ...(video.bytes > 0
          ? { "x-upload-content-length": String(video.bytes) }
          : {}),
      },
      body: JSON.stringify(metadata),
      cache: "no-store",
      signal,
    });

    if (response.ok) {
      const uri = response.headers.get("location");
      if (uri) return { ok: true, uri };
      return {
        ok: false,
        result: {
          ok: false,
          error: "YouTube didn't return an upload session.",
          needsReconnect: false,
          retryable: true,
        },
      };
    }

    return { ok: false, result: mapUploadError(response.status) };
  }

  /** Pipe the signed media URL straight into the resumable session URI. */
  private async streamVideo(
    accessToken: string,
    sessionUri: string,
    video: PublishMedia,
    signal?: AbortSignal,
  ): Promise<PublishResult> {
    const source = await fetch(video.url, { cache: "no-store", signal });
    if (!source.ok || !source.body) {
      return {
        ok: false,
        error: "Couldn't read the video from storage — it will be retried.",
        needsReconnect: false,
        retryable: true,
      };
    }

    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      "content-type": video.mimeType || "video/mp4",
    };
    if (video.bytes > 0) headers["content-length"] = String(video.bytes);

    const init: StreamingInit = {
      method: "PUT",
      headers,
      body: source.body,
      duplex: "half",
      cache: "no-store",
      signal,
    };

    const response = await fetch(sessionUri, init);
    if (!response.ok) {
      return mapUploadError(response.status);
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    if (!body.id) {
      return {
        ok: false,
        error: "YouTube accepted the upload but returned no video id.",
        needsReconnect: false,
        retryable: true,
      };
    }

    return {
      ok: true,
      externalId: body.id,
      permalink: `https://youtu.be/${body.id}`,
    };
  }
}

/** Translate an upload HTTP status onto the PublishResult failure contract. */
function mapUploadError(status: number): Extract<PublishResult, { ok: false }> {
  if (status === 401) {
    return {
      ok: false,
      error: "YouTube rejected the access token — reconnect this channel.",
      needsReconnect: true,
      retryable: false,
    };
  }
  if (status === 403) {
    return {
      ok: false,
      error:
        "YouTube declined the upload — the daily quota or channel permissions may be exhausted.",
      needsReconnect: false,
      retryable: true,
    };
  }
  if (status === 429 || status >= 500) {
    return {
      ok: false,
      error: "YouTube is busy — the upload will be retried.",
      needsReconnect: false,
      retryable: true,
    };
  }
  return {
    ok: false,
    error: "YouTube rejected the video.",
    needsReconnect: false,
    retryable: false,
  };
}

export const youtubeAdapter: PlatformAdapter = new YouTubeAdapter();
