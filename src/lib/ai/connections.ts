import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  catalogueModels,
  hasEnvKey,
  type CredentialOverrides,
} from "@/lib/ai/providers";
import type { RemoteProviderId } from "@/lib/ai/types";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Bring-your-own AI keys.
 *
 * The signed-in workspace can connect its own provider accounts; when it has,
 * generation spends its quota instead of the platform's shared keys. Reads and
 * writes run under the service role behind an authenticated session — the raw
 * key stays server-side and the browser only ever sees a masked preview.
 */

export type ConnectionStatus = "not_tested" | "connected" | "error";

export type ProviderKind = "text" | "image" | "video";

export interface ProviderMeta {
  id: RemoteProviderId;
  label: string;
  vendor: string;
  tagline: string;
  keyHint: string;
  keyUrl: string;
  keyUrlLabel: string;
  kinds: ProviderKind[];
}

/** Ordered the way the connections page presents them. */
export const PROVIDER_CATALOGUE: readonly ProviderMeta[] = [
  {
    id: "google",
    label: "Google Omni",
    vendor: "Gemini · Imagen · Veo",
    tagline:
      "One Google key powers it all — Gemini for copy, Imagen and Nano Banana for images, and Veo 3 for video.",
    keyHint: "AIza…",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyUrlLabel: "aistudio.google.com",
    kinds: ["text", "image", "video"],
  },
  {
    id: "anthropic",
    label: "Claude",
    vendor: "Anthropic",
    tagline:
      "Claude writes the most on-brand, human-sounding captions and long-form copy.",
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyUrlLabel: "console.anthropic.com",
    kinds: ["text"],
  },
  {
    id: "openai",
    label: "OpenAI",
    vendor: "OpenAI",
    tagline: "GPT for copy and GPT Image for on-the-fly visuals.",
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    keyUrlLabel: "platform.openai.com",
    kinds: ["text", "image"],
  },
  {
    id: "fal",
    label: "fal.ai",
    vendor: "fal.ai",
    tagline:
      "The media powerhouse — FLUX, Seedream and Recraft for images, Veo, Kling and Seedance for video.",
    keyHint: "fal-…:…",
    keyUrl: "https://fal.ai/dashboard/keys",
    keyUrlLabel: "fal.ai/dashboard/keys",
    kinds: ["image", "video"],
  },
  {
    id: "replicate",
    label: "Replicate",
    vendor: "Replicate",
    tagline:
      "Thousands of open models — FLUX and SDXL for images, Kling and Seedance for video.",
    keyHint: "r8_…",
    keyUrl: "https://replicate.com/account/api-tokens",
    keyUrlLabel: "replicate.com",
    kinds: ["image", "video"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    vendor: "OpenRouter",
    tagline:
      "One key, many models — a resilient gateway that keeps generation up when a single vendor wobbles.",
    keyHint: "sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
    keyUrlLabel: "openrouter.ai",
    kinds: ["text", "image"],
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    vendor: "Hugging Face",
    tagline: "Open image models — FLUX.1 and Stable Diffusion XL via Inference.",
    keyHint: "hf_…",
    keyUrl: "https://huggingface.co/settings/tokens",
    keyUrlLabel: "huggingface.co",
    kinds: ["image"],
  },
  {
    id: "imagerouter",
    label: "ImageRouter",
    vendor: "ImageRouter",
    tagline: "Free and open image models behind one OpenAI-compatible key.",
    keyHint: "sk-…",
    keyUrl: "https://imagerouter.io/keys",
    keyUrlLabel: "imagerouter.io",
    kinds: ["image"],
  },
];

const PROVIDER_IDS = PROVIDER_CATALOGUE.map((meta) => meta.id);

function isProviderId(value: string): value is RemoteProviderId {
  return (PROVIDER_IDS as string[]).includes(value);
}

/** What the connections page renders — never carries the raw key. */
export interface ConnectionView extends ProviderMeta {
  textModels: { id: string; label: string }[];
  imageModels: { id: string; label: string }[];
  videoModels: { id: string; label: string }[];
  hasKey: boolean;
  keyPreview: string | null;
  enabled: boolean;
  defaultTextModel: string | null;
  defaultImageModel: string | null;
  defaultVideoModel: string | null;
  status: ConnectionStatus;
  lastTestedAt: string | null;
  lastError: string | null;
  /** The platform carries a shared key, so this provider works without a BYO key. */
  platformManaged: boolean;
}

interface ConnectionRow {
  provider: string;
  api_key: string | null;
  enabled: boolean;
  default_text_model: string | null;
  default_image_model: string | null;
  default_video_model: string | null;
  status: ConnectionStatus;
  last_tested_at: string | null;
  last_error: string | null;
}

/**
 * Untyped service client. The hand-maintained table map carries no PostgREST
 * select metadata, so the typed builder collapses to `never`; naming the row
 * shape per query keeps this honest — the same trade-off `licenses.ts` makes.
 */
function service(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

/** Last four characters behind a fixed-width mask, e.g. `sk-…••••a1b2`. */
function maskKey(key: string): string {
  const tail = key.slice(-4);
  return `••••••••${tail}`;
}

async function rowsForUser(userId: string): Promise<Map<string, ConnectionRow>> {
  const { data } = await service()
    .from("ai_connections")
    .select(
      "provider, api_key, enabled, default_text_model, default_image_model, default_video_model, status, last_tested_at, last_error",
    )
    .eq("user_id", userId);

  const rows = (data as ConnectionRow[] | null) ?? [];
  return new Map(rows.map((row) => [row.provider, row]));
}

function buildView(meta: ProviderMeta, row: ConnectionRow | undefined): ConnectionView {
  const key = row?.api_key?.trim() || null;
  return {
    ...meta,
    textModels: meta.kinds.includes("text")
      ? catalogueModels(meta.id, "text")
      : [],
    imageModels: meta.kinds.includes("image")
      ? catalogueModels(meta.id, "image")
      : [],
    videoModels: meta.kinds.includes("video")
      ? catalogueModels(meta.id, "video")
      : [],
    hasKey: key !== null,
    keyPreview: key ? maskKey(key) : null,
    enabled: row?.enabled ?? true,
    defaultTextModel: row?.default_text_model ?? null,
    defaultImageModel: row?.default_image_model ?? null,
    defaultVideoModel: row?.default_video_model ?? null,
    status: row?.status ?? "not_tested",
    lastTestedAt: row?.last_tested_at ?? null,
    lastError: row?.last_error ?? null,
    platformManaged: hasEnvKey(meta.id),
  };
}

/** Every provider's connection state for the signed-in user. */
export async function getConnections(): Promise<ConnectionView[]> {
  let rows = new Map<string, ConnectionRow>();

  if (isSupabaseConfigured()) {
    try {
      const session = await getSession();
      if (session) rows = await rowsForUser(session.userId);
    } catch {
      // Fall back to catalogue defaults rather than 500 the page.
    }
  }

  return PROVIDER_CATALOGUE.map((meta) => buildView(meta, rows.get(meta.id)));
}

/**
 * Enabled per-provider keys for a user, ready to hand to `runWithCredentials`.
 * A disabled or keyless connection simply doesn't appear, so the router falls
 * back to the platform key (or to simulated output).
 */
export async function credentialsForUser(
  userId: string,
): Promise<CredentialOverrides> {
  if (!isSupabaseConfigured()) return {};

  try {
    const rows = await rowsForUser(userId);
    const map: CredentialOverrides = {};
    for (const [provider, row] of rows) {
      const key = row.api_key?.trim();
      if (row.enabled && key && isProviderId(provider)) map[provider] = key;
    }
    return map;
  } catch {
    return {};
  }
}

/** Credential overrides for the signed-in user, or none when signed out. */
export async function currentUserCredentials(): Promise<CredentialOverrides> {
  if (!isSupabaseConfigured()) return {};
  try {
    const session = await getSession();
    return session ? credentialsForUser(session.userId) : {};
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------
   Mutations
   ------------------------------------------------------------------------- */

export type SaveResult = { ok: true } | { ok: false; error: string };
export type TestResult =
  | { ok: true; status: "connected" }
  | { ok: false; error: string };

export interface SaveConnectionInput {
  provider: string;
  /** New key, or blank to keep the stored one untouched. */
  apiKey?: string;
  enabled: boolean;
  defaultTextModel?: string | null;
  defaultImageModel?: string | null;
  defaultVideoModel?: string | null;
}

/**
 * Create or update a provider connection. A blank `apiKey` preserves the stored
 * key (so a user can toggle `enabled` or change a default model without
 * re-pasting the secret); a new key resets the tested status.
 */
export async function saveConnection(
  input: SaveConnectionInput,
): Promise<SaveResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Connections aren't available in demo mode." };
  }
  if (!isProviderId(input.provider)) {
    return { ok: false, error: "Unknown provider." };
  }

  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Your session expired — sign in and try again." };
  }

  const newKey = input.apiKey?.trim();

  try {
    const db = service();
    const { data: existing } = await db
      .from("ai_connections")
      .select("api_key")
      .eq("user_id", session.userId)
      .eq("provider", input.provider)
      .maybeSingle();

    if (!existing && !newKey) {
      return { ok: false, error: "Paste your API key to connect this provider." };
    }

    const patch: Record<string, unknown> = {
      enabled: input.enabled,
      default_text_model: input.defaultTextModel || null,
      default_image_model: input.defaultImageModel || null,
      default_video_model: input.defaultVideoModel || null,
    };
    if (newKey) {
      patch.api_key = newKey;
      // A fresh key hasn't been proven yet.
      patch.status = "not_tested";
      patch.last_error = null;
      patch.last_tested_at = null;
    }

    if (existing) {
      const { error } = await db
        .from("ai_connections")
        .update(patch)
        .eq("user_id", session.userId)
        .eq("provider", input.provider);
      if (error) return { ok: false, error: "Couldn't save. Please try again." };
    } else {
      const { error } = await db.from("ai_connections").insert({
        user_id: session.userId,
        provider: input.provider,
        ...patch,
      });
      if (error) return { ok: false, error: "Couldn't save. Please try again." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save. Please try again." };
  }
}

/** Remove a provider connection and its stored key entirely. */
export async function disconnectConnection(
  provider: string,
): Promise<SaveResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Connections aren't available in demo mode." };
  }
  if (!isProviderId(provider)) return { ok: false, error: "Unknown provider." };

  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Your session expired — sign in and try again." };
  }

  try {
    const { error } = await service()
      .from("ai_connections")
      .delete()
      .eq("user_id", session.userId)
      .eq("provider", provider);
    if (error) return { ok: false, error: "Couldn't disconnect. Please try again." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't disconnect. Please try again." };
  }
}

/**
 * Validate the stored key against the provider with the cheapest authenticated
 * call each vendor offers (a models/key list — no tokens spent), and record the
 * outcome so the connection card can show an honest status.
 */
export async function testConnection(provider: string): Promise<TestResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Connections aren't available in demo mode." };
  }
  if (!isProviderId(provider)) return { ok: false, error: "Unknown provider." };

  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Your session expired — sign in and try again." };
  }

  try {
    const db = service();
    const { data } = await db
      .from("ai_connections")
      .select("api_key")
      .eq("user_id", session.userId)
      .eq("provider", provider)
      .maybeSingle();

    const key = (data as { api_key: string | null } | null)?.api_key?.trim();
    if (!key) {
      return { ok: false, error: "Save your API key first, then test it." };
    }

    const check = await probe(provider, key);
    await db
      .from("ai_connections")
      .update({
        status: check.ok ? "connected" : "error",
        last_tested_at: new Date().toISOString(),
        last_error: check.ok ? null : check.error,
      })
      .eq("user_id", session.userId)
      .eq("provider", provider);

    return check.ok
      ? { ok: true, status: "connected" }
      : { ok: false, error: check.error };
  } catch {
    return { ok: false, error: "Couldn't reach the provider. Try again shortly." };
  }
}

/* -------------------------------------------------------------------------
   Provider reachability probes
   ------------------------------------------------------------------------- */

interface ProbeConfig {
  url: string;
  headers: Record<string, string>;
}

function probeConfig(provider: RemoteProviderId, key: string): ProbeConfig {
  switch (provider) {
    case "openai":
      return {
        url: "https://api.openai.com/v1/models",
        headers: { authorization: `Bearer ${key}` },
      };
    case "openrouter":
      return {
        url: "https://openrouter.ai/api/v1/key",
        headers: { authorization: `Bearer ${key}` },
      };
    case "google":
      return {
        url: "https://generativelanguage.googleapis.com/v1beta/models",
        headers: { "x-goog-api-key": key },
      };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/models",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      };
    case "fal":
      // fal has no auth-check endpoint; the app listing 401s on a bad key.
      return {
        url: "https://rest.alpha.fal.ai/apps",
        headers: { authorization: `Key ${key}` },
      };
    case "replicate":
      return {
        url: "https://api.replicate.com/v1/account",
        headers: { authorization: `Bearer ${key}` },
      };
    case "huggingface":
      return {
        url: "https://huggingface.co/api/whoami-v2",
        headers: { authorization: `Bearer ${key}` },
      };
    case "imagerouter":
      return {
        url: "https://api.imagerouter.io/v1/models",
        headers: { authorization: `Bearer ${key}` },
      };
  }
}

async function probe(
  provider: RemoteProviderId,
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { url, headers } = probeConfig(provider, key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.ok) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "The provider rejected this key." };
    }
    if (response.status === 429) {
      return { ok: false, error: "Rate limited by the provider — try again shortly." };
    }
    return { ok: false, error: `The provider returned ${response.status}.` };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "The provider timed out." };
    }
    return { ok: false, error: "Couldn't reach the provider." };
  } finally {
    clearTimeout(timer);
  }
}
