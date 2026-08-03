import "server-only";

import type { PlatformId, PostFormat } from "@/lib/platforms";

/**
 * The publishing contract.
 *
 * Every network implements the same four verbs — build a consent URL, exchange
 * the callback code, refresh an access token, publish one target — so the OAuth
 * routes and the dispatcher stay platform-agnostic and only the adapter knows
 * each API's dialect. CSRF/PKCE, encryption and media upload are handled by the
 * caller, not the adapter, so no network can get that wrong on its own.
 */

/**
 * A decrypted OAuth token set as the app holds it in memory. Never persisted in
 * this shape — access/refresh are written back AES-GCM encrypted (see tokens.ts).
 */
export interface TokenSet {
  accessToken: string;
  /** Null when the network issues access-only (long-lived) tokens. */
  refreshToken: string | null;
  tokenType: string | null;
  /** Absolute expiry, or null when the token does not expire. */
  expiresAt: Date | null;
  scopes: string[];
}

/**
 * Who the exchanged tokens belong to on the remote network. Written to
 * social_accounts so the dispatcher can address the right page / channel / user.
 */
export interface RemoteIdentity {
  /** Stable per-network id: page id, IG business id, channel id, member id. */
  externalId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  /**
   * Per-platform ids publishing needs later — e.g. Facebook page id + page
   * token, Instagram user id, LinkedIn author urn. Stored in
   * social_accounts.provider_metadata and never shown to the browser.
   */
  metadata: Record<string, unknown>;
}

/**
 * Everything an authorize URL needs. `state` and `codeChallenge` are minted by
 * the route (state.ts), not the adapter, so CSRF/PKCE handling is uniform.
 */
export interface AuthorizeParams {
  redirectUri: string;
  state: string;
  /** PKCE S256 challenge; adapters that don't use PKCE ignore it. */
  codeChallenge: string;
  /** Extra scopes on top of the adapter's defaults. Rarely used. */
  scopes?: readonly string[];
}

export interface ExchangeParams {
  code: string;
  redirectUri: string;
  /** PKCE verifier matching the challenge sent to authorizeUrl. */
  codeVerifier: string;
}

/**
 * One media item the dispatcher hands to an adapter. Already uploaded to
 * Supabase Storage and reachable at a signed URL the network can fetch (or that
 * the adapter streams bytes from when the API has no pull-from-URL path).
 */
export interface PublishMedia {
  kind: "image" | "video";
  url: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
}

/** The fully-resolved job for a single post_target. */
export interface PublishInput {
  /** Caption already resolved (caption_override ?? post.body) and trimmed. */
  caption: string;
  title: string | null;
  format: PostFormat;
  media: PublishMedia[];
  /** Live access token for this account; the dispatcher refreshes before calling. */
  token: TokenSet;
  /** The connected account's identity + provider_metadata. */
  account: RemoteIdentity;
}

export type PublishResult =
  | {
      ok: true;
      /** Network's id for the created post — stored in external_post_id. */
      externalId: string;
      /** Public permalink when the API returns one. */
      permalink: string | null;
    }
  | {
      ok: false;
      /** Safe, user-facing message — never carries tokens or a raw upstream body. */
      error: string;
      /** A refresh/reconnect is the fix: flag the account rather than just the target. */
      needsReconnect: boolean;
      /** The failure is transient and the target should be retried with backoff. */
      retryable: boolean;
    };

export interface PlatformAdapter {
  readonly platform: PlatformId;
  /** OAuth scopes requested at connect time. */
  readonly defaultScopes: readonly string[];
  /** False for networks with no refresh flow (long-lived tokens only). */
  readonly supportsRefresh: boolean;

  /** Build the network's consent URL to redirect the browser to. */
  authorizeUrl(params: AuthorizeParams): string;

  /** Exchange the callback code for tokens and resolve the account identity. */
  exchangeCode(
    params: ExchangeParams,
  ): Promise<{ token: TokenSet; identity: RemoteIdentity }>;

  /**
   * Refresh an expiring access token. Returns null when the network cannot
   * refresh and the user must reconnect — that null is the contract, so this
   * never throws for the unsupported case.
   */
  refresh(token: TokenSet): Promise<TokenSet | null>;

  /**
   * Publish one target. Implementations translate PublishInput into the
   * network's own upload+publish dance and map every failure onto PublishResult
   * rather than throwing.
   */
  publish(input: PublishInput, signal?: AbortSignal): Promise<PublishResult>;
}
