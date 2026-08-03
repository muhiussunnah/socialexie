import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformId } from "@/lib/platforms";
import { decryptToken, encryptToken } from "@/lib/publish/crypto";
import { adapterFor } from "@/lib/publish/registry";
import type { RemoteIdentity, TokenSet } from "@/lib/publish/types";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * The connected-account token store.
 *
 * Tokens live on social_accounts as AES-GCM envelopes. This module is the only
 * place that opens them: it decrypts on the way out, refreshes through the
 * adapter when the access token is about to lapse, and re-seals whatever it
 * writes back. Everything runs under the service role because the dispatcher is
 * a background job with no user session, and the ciphertext columns are not
 * readable under RLS in any case.
 */

/** Refresh anything within five minutes of expiry rather than racing the clock. */
const REFRESH_SKEW_MS = 5 * 60_000;

function service(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

interface AccountRow {
  id: string;
  platform: PlatformId;
  external_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_type: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  provider_metadata: Record<string, unknown> | null;
}

export type LiveTokenResult =
  | { ok: true; token: TokenSet; identity: RemoteIdentity }
  | { ok: false; error: string; needsReconnect: boolean };

function identityFromRow(row: AccountRow): RemoteIdentity {
  return {
    externalId: row.external_id,
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    metadata: row.provider_metadata ?? {},
  };
}

/**
 * A usable access token for one connected account, refreshing first when it is
 * close to expiry. Never throws: every failure that a caller could act on comes
 * back as `{ ok: false, needsReconnect }` so the dispatcher can flag the account
 * instead of aborting the batch.
 */
export async function liveTokenForAccount(
  accountId: string,
): Promise<LiveTokenResult> {
  const { data } = await service()
    .from("social_accounts")
    .select(
      "id, platform, external_id, handle, display_name, avatar_url, access_token_enc, refresh_token_enc, token_type, token_expires_at, scopes, provider_metadata",
    )
    .eq("id", accountId)
    .maybeSingle();

  const row = data as AccountRow | null;
  if (!row) {
    return { ok: false, error: "Connected account not found.", needsReconnect: true };
  }
  if (!row.access_token_enc) {
    return {
      ok: false,
      error: "This channel needs reconnecting.",
      needsReconnect: true,
    };
  }

  const identity = identityFromRow(row);

  let token: TokenSet;
  try {
    token = {
      accessToken: await decryptToken(row.access_token_enc),
      refreshToken: row.refresh_token_enc
        ? await decryptToken(row.refresh_token_enc)
        : null,
      tokenType: row.token_type,
      expiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
      scopes: row.scopes ?? [],
    };
  } catch {
    return {
      ok: false,
      error: "Stored credentials couldn't be read — reconnect this channel.",
      needsReconnect: true,
    };
  }

  const expiringSoon =
    token.expiresAt !== null &&
    token.expiresAt.getTime() - Date.now() <= REFRESH_SKEW_MS;
  if (!expiringSoon) {
    return { ok: true, token, identity };
  }

  const adapter = adapterFor(row.platform);
  if (!adapter || !adapter.supportsRefresh || !token.refreshToken) {
    return {
      ok: false,
      error: "This channel's access has expired — reconnect it.",
      needsReconnect: true,
    };
  }

  try {
    const refreshed = await adapter.refresh(token);
    if (!refreshed) {
      return {
        ok: false,
        error: "This channel's access has expired — reconnect it.",
        needsReconnect: true,
      };
    }
    await persistTokens(accountId, refreshed);
    return { ok: true, token: refreshed, identity };
  } catch {
    return {
      ok: false,
      error: "Couldn't refresh this channel's access.",
      needsReconnect: true,
    };
  }
}

/** Re-seal and store a token set, marking the account healthy again. */
export async function persistTokens(
  accountId: string,
  token: TokenSet,
): Promise<void> {
  const patch: Record<string, unknown> = {
    access_token_enc: await encryptToken(token.accessToken),
    refresh_token_enc: token.refreshToken
      ? await encryptToken(token.refreshToken)
      : null,
    token_type: token.tokenType,
    token_expires_at: token.expiresAt ? token.expiresAt.toISOString() : null,
    scopes: token.scopes,
    status: "active",
    last_error: null,
  };

  await service().from("social_accounts").update(patch).eq("id", accountId);
}
