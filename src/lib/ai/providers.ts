import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import {
  NoProviderError,
  ProviderError,
  type GeneratedImage,
  type GeneratedVideo,
  type ImageProvider,
  type ModelKind,
  type ModelOption,
  type ModelSpec,
  type ProviderFailure,
  type ProviderId,
  type ProviderStatus,
  type RemoteProviderId,
  type TextJob,
  type TextProvider,
  type TextVariant,
  type VideoProvider,
} from "@/lib/ai/types";

/**
 * Provider registry and router.
 *
 * Keys are optional by design: a fresh clone with no `.env` still renders the
 * studio, and every provider that *is* configured joins the fallback chain. The
 * request/response mapping for each vendor lives in exactly one function so a
 * wire-format change is a single-place edit.
 */

/* -------------------------------------------------------------------------
   Credentials
   ------------------------------------------------------------------------- */

const KEY_NAMES: Record<RemoteProviderId, string> = {
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  fal: "FAL_KEY",
  replicate: "REPLICATE_API_TOKEN",
  huggingface: "HF_TOKEN",
  imagerouter: "IMAGEROUTER_API_KEY",
};

/** Per-provider key overrides supplied by the signed-in workspace. */
export type CredentialOverrides = Partial<Record<RemoteProviderId, string>>;

/**
 * Request-scoped credential context. When a caller wraps generation in
 * `runWithCredentials`, a stored key takes precedence over the platform's
 * environment key for that provider — so a workspace can bring its own account
 * and spend its own quota, while a fresh clone still falls back to the shared
 * keys (or to simulated output when neither exists).
 */
const credentialStore = new AsyncLocalStorage<CredentialOverrides>();

export function runWithCredentials<T>(
  overrides: CredentialOverrides,
  run: () => Promise<T>,
): Promise<T> {
  return credentialStore.run(overrides, run);
}

/** True when the platform itself carries a key for this provider in the env. */
export function hasEnvKey(provider: RemoteProviderId): boolean {
  return Boolean(process.env[KEY_NAMES[provider]]?.trim());
}

function apiKey(provider: RemoteProviderId): string | null {
  const override = credentialStore.getStore()?.[provider]?.trim();
  if (override) return override;
  const raw = process.env[KEY_NAMES[provider]];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

function requireKey(provider: RemoteProviderId): string {
  const key = apiKey(provider);
  if (!key) {
    throw new ProviderError(provider, null, `${provider} is not configured`);
  }
  return key;
}

/* -------------------------------------------------------------------------
   Concurrency guard
   ------------------------------------------------------------------------- */

interface GateConfig {
  concurrency: number;
  /** Floor on the gap between two request starts, to smooth a burst. */
  minIntervalMs: number;
}

/**
 * Per-provider admission control. This is process-local: it protects a single
 * server instance from stampeding a vendor, and a multi-instance deployment
 * still needs a shared limiter in front of it.
 */
class Gate {
  private active = 0;
  private lastStart = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly config: GateConfig) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      this.waiting.push(resolve);
      this.pump();
    });
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.pump();
    }
  }

  private pump(): void {
    if (this.active >= this.config.concurrency) return;
    if (this.waiting.length === 0) return;

    const wait = this.config.minIntervalMs - (Date.now() - this.lastStart);
    if (wait > 0) {
      if (this.timer === null) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.pump();
        }, wait);
      }
      return;
    }

    const next = this.waiting.shift();
    if (!next) return;
    this.active += 1;
    this.lastStart = Date.now();
    next();
  }
}

const GATES: Record<RemoteProviderId, Gate> = {
  openrouter: new Gate({ concurrency: 4, minIntervalMs: 120 }),
  google: new Gate({ concurrency: 3, minIntervalMs: 150 }),
  openai: new Gate({ concurrency: 3, minIntervalMs: 150 }),
  anthropic: new Gate({ concurrency: 3, minIntervalMs: 150 }),
  // Media vendors are slower and stricter, so admit fewer at a time.
  fal: new Gate({ concurrency: 2, minIntervalMs: 250 }),
  replicate: new Gate({ concurrency: 2, minIntervalMs: 250 }),
  huggingface: new Gate({ concurrency: 2, minIntervalMs: 300 }),
  imagerouter: new Gate({ concurrency: 2, minIntervalMs: 200 }),
};

/* -------------------------------------------------------------------------
   Transport
   ------------------------------------------------------------------------- */

const DEFAULT_TIMEOUT_MS = 90_000;

interface FetchContext {
  provider: RemoteProviderId;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** POST JSON through the provider's gate and hand back the parsed body. */
async function postJson(
  url: string,
  init: { headers: Record<string, string>; body: unknown },
  context: FetchContext,
): Promise<unknown> {
  return GATES[context.provider].run(async () => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      context.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    const relay = () => controller.abort();
    context.signal?.addEventListener("abort", relay);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...init.headers },
        body: JSON.stringify(init.body),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        // Upstream error bodies routinely echo the prompt and sometimes the
        // key prefix, so the text is kept as `detail` for the server log only.
        const detail = await response.text().catch(() => "");
        throw new ProviderError(
          context.provider,
          response.status,
          `${context.provider} responded ${response.status}`,
          detail.slice(0, 1_000),
        );
      }

      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const message =
        error instanceof Error ? error.message : "upstream request failed";
      throw new ProviderError(context.provider, null, message);
    } finally {
      clearTimeout(timer);
      context.signal?.removeEventListener("abort", relay);
    }
  });
}

/**
 * Lower-level sibling of `postJson` for responses that aren't JSON (image
 * bytes) or flows that need several round-trips (prediction polling). Applies
 * the same gate, timeout and abort relay, and hands back the raw `Response`.
 */
async function requestThroughGate(
  provider: RemoteProviderId,
  url: string,
  init: RequestInit,
  context: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Response> {
  return GATES[provider].run(async () => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      context.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    const relay = () => controller.abort();
    context.signal?.addEventListener("abort", relay);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new ProviderError(
          provider,
          response.status,
          `${provider} responded ${response.status}`,
          detail.slice(0, 1_000),
        );
      }
      return response;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const message =
        error instanceof Error ? error.message : "upstream request failed";
      throw new ProviderError(provider, null, message);
    } finally {
      clearTimeout(timer);
      context.signal?.removeEventListener("abort", relay);
    }
  });
}

/** Abort-aware delay used between polls of an async media job. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/* -------------------------------------------------------------------------
   Unknown-JSON accessors
   ------------------------------------------------------------------------- */

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function dig(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) current = asRecord(current)[key];
  return current;
}

/* -------------------------------------------------------------------------
   Shared shaping helpers
   ------------------------------------------------------------------------- */

/** Split a batch into per-call counts a provider will accept. */
function batches(total: number, perCall: number): number[] {
  const out: number[] = [];
  for (let left = total; left > 0; left -= perCall) {
    out.push(Math.min(perCall, left));
  }
  return out;
}

function toVariant(text: string): TextVariant {
  const trimmed = text.trim();
  return { text: trimmed, characters: trimmed.length };
}

/**
 * Turn a completion into discrete caption options. Models are asked for a JSON
 * array; the line-splitting path covers the ones that answer in prose anyway.
 */
function parseVariants(raw: string, count: number): TextVariant[] {
  const body = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed: unknown = JSON.parse(body);
    const items = asArray(parsed).filter(
      (item): item is string => typeof item === "string" && item.trim() !== "",
    );
    if (items.length > 0) return items.slice(0, count).map(toVariant);
  } catch {
    // Not JSON — fall through to the text split.
  }

  const paragraphs = body
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
  const source =
    paragraphs.length > 1
      ? paragraphs
      : body
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

  const cleaned = source
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

  return (cleaned.length > 0 ? cleaned : [body]).slice(0, count).map(toVariant);
}

function dataUri(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

const GOOGLE_RATIOS: readonly [string, number][] = [
  ["1:1", 1],
  ["2:3", 2 / 3],
  ["3:2", 3 / 2],
  ["3:4", 3 / 4],
  ["4:3", 4 / 3],
  ["4:5", 4 / 5],
  ["5:4", 5 / 4],
  ["9:16", 9 / 16],
  ["16:9", 16 / 9],
  ["21:9", 21 / 9],
];

/** Image models take a named ratio, not pixels; pick the closest one. */
function nearestRatio(
  width: number,
  height: number,
  table: readonly [string, number][],
): string {
  const target = width / height;
  let best = table[0];
  for (const entry of table) {
    if (Math.abs(entry[1] - target) < Math.abs(best[1] - target)) best = entry;
  }
  return best[0];
}

const OPENAI_SIZES: readonly [string, number][] = [
  ["1024x1024", 1],
  ["1024x1536", 1024 / 1536],
  ["1536x1024", 1536 / 1024],
];

/* -------------------------------------------------------------------------
   Model catalogue
   ------------------------------------------------------------------------- */

const IMAGE_MODELS: readonly ModelSpec[] = [
  {
    id: "openrouter/gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    provider: "openrouter",
    kind: "image",
    remoteId: "google/gemini-2.5-flash-image",
    capabilities: ["text-to-image", "image-edit", "typography"],
    maxWidth: 2048,
    maxHeight: 2048,
    approxCentsPerImage: 4,
  },
  {
    id: "google/gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    provider: "google",
    kind: "image",
    remoteId: "gemini-2.5-flash-image",
    capabilities: ["text-to-image", "image-edit", "aspect-control", "typography"],
    maxWidth: 2048,
    maxHeight: 2048,
    approxCentsPerImage: 4,
  },
  {
    id: "google/imagen-4",
    label: "Imagen 4",
    provider: "google",
    kind: "image",
    remoteId: "imagen-4.0-generate-001",
    capabilities: ["text-to-image", "aspect-control"],
    maxWidth: 2048,
    maxHeight: 2048,
    approxCentsPerImage: 4,
  },
  {
    id: "openai/gpt-image-1",
    label: "GPT Image 1",
    provider: "openai",
    kind: "image",
    remoteId: "gpt-image-1",
    capabilities: ["text-to-image", "image-edit", "typography"],
    maxWidth: 1536,
    maxHeight: 1536,
    approxCentsPerImage: 4,
  },
  {
    id: "fal/flux-1.1-pro",
    label: "FLUX 1.1 Pro",
    provider: "fal",
    kind: "image",
    remoteId: "fal-ai/flux-pro/v1.1",
    capabilities: ["text-to-image", "aspect-control", "typography"],
    maxWidth: 2048,
    maxHeight: 2048,
    approxCentsPerImage: 4,
  },
  {
    id: "fal/flux-dev",
    label: "FLUX.1 dev",
    provider: "fal",
    kind: "image",
    remoteId: "fal-ai/flux/dev",
    capabilities: ["text-to-image", "aspect-control"],
    maxWidth: 1536,
    maxHeight: 1536,
    approxCentsPerImage: 3,
  },
  {
    id: "fal/seedream-3",
    label: "Seedream 3.0",
    provider: "fal",
    kind: "image",
    remoteId: "fal-ai/bytedance/seedream/v3/text-to-image",
    capabilities: ["text-to-image", "aspect-control", "typography"],
    maxWidth: 2048,
    maxHeight: 2048,
    approxCentsPerImage: 3,
  },
  {
    id: "fal/recraft-v3",
    label: "Recraft V3",
    provider: "fal",
    kind: "image",
    remoteId: "fal-ai/recraft-v3",
    capabilities: ["text-to-image", "aspect-control", "typography"],
    maxWidth: 2048,
    maxHeight: 2048,
    approxCentsPerImage: 4,
  },
  {
    id: "replicate/flux-1.1-pro",
    label: "FLUX 1.1 Pro",
    provider: "replicate",
    kind: "image",
    remoteId: "black-forest-labs/flux-1.1-pro",
    capabilities: ["text-to-image", "aspect-control", "typography"],
    maxWidth: 2048,
    maxHeight: 2048,
    approxCentsPerImage: 4,
  },
  {
    id: "replicate/sdxl",
    label: "Stable Diffusion XL",
    provider: "replicate",
    kind: "image",
    remoteId: "stability-ai/sdxl",
    capabilities: ["text-to-image", "aspect-control"],
    maxWidth: 1536,
    maxHeight: 1536,
    approxCentsPerImage: 2,
  },
  {
    id: "huggingface/flux-1-dev",
    label: "FLUX.1 dev",
    provider: "huggingface",
    kind: "image",
    remoteId: "black-forest-labs/FLUX.1-dev",
    capabilities: ["text-to-image"],
    maxWidth: 1360,
    maxHeight: 1360,
    approxCentsPerImage: 1,
  },
  {
    id: "huggingface/sdxl",
    label: "Stable Diffusion XL",
    provider: "huggingface",
    kind: "image",
    remoteId: "stabilityai/stable-diffusion-xl-base-1.0",
    capabilities: ["text-to-image"],
    maxWidth: 1024,
    maxHeight: 1024,
    approxCentsPerImage: 1,
  },
  {
    id: "imagerouter/flux-1-schnell",
    label: "FLUX.1 schnell (free)",
    provider: "imagerouter",
    kind: "image",
    remoteId: "black-forest-labs/FLUX-1-schnell:free",
    capabilities: ["text-to-image", "aspect-control"],
    maxWidth: 1536,
    maxHeight: 1536,
    approxCentsPerImage: 0,
  },
  {
    id: "imagerouter/sdxl-turbo",
    label: "SDXL Turbo (free)",
    provider: "imagerouter",
    kind: "image",
    remoteId: "stabilityai/sdxl-turbo:free",
    capabilities: ["text-to-image"],
    maxWidth: 1024,
    maxHeight: 1024,
    approxCentsPerImage: 0,
  },
];

const VIDEO_MODELS: readonly ModelSpec[] = [
  {
    id: "google/veo-3",
    label: "Veo 3",
    provider: "google",
    kind: "video",
    remoteId: "veo-3.0-generate-001",
    capabilities: ["text-to-video", "image-to-video", "aspect-control"],
    maxDurationSeconds: 8,
    approxCentsPerSecond: 40,
  },
  {
    id: "google/veo-3-fast",
    label: "Veo 3 Fast",
    provider: "google",
    kind: "video",
    remoteId: "veo-3.0-fast-generate-001",
    capabilities: ["text-to-video", "aspect-control"],
    maxDurationSeconds: 8,
    approxCentsPerSecond: 15,
  },
  {
    id: "fal/veo-3",
    label: "Veo 3 (via fal)",
    provider: "fal",
    kind: "video",
    remoteId: "fal-ai/veo3",
    capabilities: ["text-to-video", "aspect-control"],
    maxDurationSeconds: 8,
    approxCentsPerSecond: 40,
  },
  {
    id: "fal/kling-2.1",
    label: "Kling 2.1",
    provider: "fal",
    kind: "video",
    remoteId: "fal-ai/kling-video/v2.1/master/text-to-video",
    capabilities: ["text-to-video", "image-to-video", "aspect-control"],
    maxDurationSeconds: 10,
    approxCentsPerSecond: 12,
  },
  {
    id: "fal/seedance-1",
    label: "Seedance 1.0 Pro",
    provider: "fal",
    kind: "video",
    remoteId: "fal-ai/bytedance/seedance/v1/pro/text-to-video",
    capabilities: ["text-to-video", "image-to-video", "aspect-control"],
    maxDurationSeconds: 10,
    approxCentsPerSecond: 10,
  },
  {
    id: "replicate/kling-2.1",
    label: "Kling 2.1",
    provider: "replicate",
    kind: "video",
    remoteId: "kwaivgi/kling-v2.1",
    capabilities: ["text-to-video", "image-to-video", "aspect-control"],
    maxDurationSeconds: 10,
    approxCentsPerSecond: 12,
  },
  {
    id: "replicate/seedance-1",
    label: "Seedance 1.0 Pro",
    provider: "replicate",
    kind: "video",
    remoteId: "bytedance/seedance-1-pro",
    capabilities: ["text-to-video", "image-to-video", "aspect-control"],
    maxDurationSeconds: 10,
    approxCentsPerSecond: 10,
  },
];

const TEXT_MODELS: readonly ModelSpec[] = [
  {
    id: "openrouter/gpt-4.1-mini",
    label: "GPT-4.1 mini",
    provider: "openrouter",
    kind: "text",
    remoteId: "openai/gpt-4.1-mini",
    capabilities: ["chat", "json-output"],
    approxCentsPerMTok: 60,
  },
  {
    id: "openrouter/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "openrouter",
    kind: "text",
    remoteId: "google/gemini-2.5-flash",
    capabilities: ["chat", "json-output", "long-context"],
    approxCentsPerMTok: 90,
  },
  {
    id: "openrouter/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    provider: "openrouter",
    kind: "text",
    remoteId: "anthropic/claude-sonnet-4.5",
    capabilities: ["chat", "json-output", "long-context"],
    approxCentsPerMTok: 800,
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    kind: "text",
    remoteId: "gemini-2.5-flash",
    capabilities: ["chat", "json-output", "long-context"],
    approxCentsPerMTok: 90,
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    kind: "text",
    remoteId: "gemini-2.5-pro",
    capabilities: ["chat", "json-output", "long-context"],
    approxCentsPerMTok: 700,
  },
  {
    id: "openai/gpt-4.1-mini",
    label: "GPT-4.1 mini",
    provider: "openai",
    kind: "text",
    remoteId: "gpt-4.1-mini",
    capabilities: ["chat", "json-output"],
    approxCentsPerMTok: 60,
  },
  {
    id: "openai/gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
    kind: "text",
    remoteId: "gpt-4.1",
    capabilities: ["chat", "json-output", "long-context"],
    approxCentsPerMTok: 500,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    kind: "text",
    remoteId: "claude-haiku-4-5",
    capabilities: ["chat", "long-context"],
    approxCentsPerMTok: 200,
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    provider: "anthropic",
    kind: "text",
    remoteId: "claude-sonnet-4-5",
    capabilities: ["chat", "long-context"],
    approxCentsPerMTok: 800,
  },
];

const PROVIDER_LABELS: Record<RemoteProviderId, string> = {
  openrouter: "OpenRouter",
  google: "Google AI",
  openai: "OpenAI",
  anthropic: "Anthropic",
  fal: "fal.ai",
  replicate: "Replicate",
  huggingface: "Hugging Face",
  imagerouter: "ImageRouter",
};

function catalogueFor(kind: ModelKind): readonly ModelSpec[] {
  if (kind === "image") return IMAGE_MODELS;
  if (kind === "video") return VIDEO_MODELS;
  return TEXT_MODELS;
}

function modelsFor(provider: RemoteProviderId, kind: ModelKind): ModelSpec[] {
  return catalogueFor(kind).filter((model) => model.provider === provider);
}

/** The models a provider offers for a kind, as lightweight option rows. */
export function catalogueModels(
  provider: RemoteProviderId,
  kind: ModelKind,
): { id: string; label: string }[] {
  return modelsFor(provider, kind).map((model) => ({
    id: model.id,
    label: model.label,
  }));
}

/* -------------------------------------------------------------------------
   Image providers
   ------------------------------------------------------------------------- */

/**
 * OpenRouter exposes image models through the chat endpoint: ask for the image
 * modality and the picture comes back as a data URI on the assistant message.
 * One call yields one image, so a batch fans out through the gate.
 */
const openRouterImage: ImageProvider = {
  id: "openrouter",
  kind: "image",
  label: PROVIDER_LABELS.openrouter,
  models: modelsFor("openrouter", "image"),
  isConfigured: () => apiKey("openrouter") !== null,
  async generate(job, model, signal) {
    const key = requireKey("openrouter");
    const single = async (): Promise<GeneratedImage[]> => {
      const payload = await postJson(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          headers: {
            authorization: `Bearer ${key}`,
            "http-referer": process.env.NEXT_PUBLIC_SITE_URL ?? "",
            "x-title": "Socialexie Studio",
          },
          body: {
            model: model.remoteId,
            modalities: ["image", "text"],
            messages: [{ role: "user", content: job.prompt }],
          },
        },
        { provider: "openrouter", signal },
      );

      const images = asArray(
        dig(asArray(dig(payload, "choices"))[0], "message", "images"),
      );
      return images
        .map((item) => asString(dig(item, "image_url", "url")))
        .filter((url): url is string => url !== null)
        .map((url) => ({
          url,
          width: job.width,
          height: job.height,
          mimeType: mimeFromDataUri(url),
        }));
    };

    const results = await Promise.all(
      batches(job.count, 1).map(() => single()),
    );
    return results.flat();
  },
};

/**
 * Google serves two image families behind one key: the Gemini image model on
 * `generateContent`, and Imagen on `predict`. They differ enough in both
 * directions that each gets its own mapping.
 */
const googleImage: ImageProvider = {
  id: "google",
  kind: "image",
  label: PROVIDER_LABELS.google,
  models: modelsFor("google", "image"),
  isConfigured: () => apiKey("google") !== null,
  async generate(job, model, signal) {
    const key = requireKey("google");
    const ratio = nearestRatio(job.width, job.height, GOOGLE_RATIOS);
    const headers = { "x-goog-api-key": key };
    const base = "https://generativelanguage.googleapis.com/v1beta/models";

    if (model.remoteId.startsWith("imagen")) {
      const chunks = await Promise.all(
        batches(job.count, 4).map(async (sampleCount) => {
          const payload = await postJson(
            `${base}/${model.remoteId}:predict`,
            {
              headers,
              body: {
                instances: [{ prompt: job.prompt }],
                parameters: { sampleCount, aspectRatio: ratio },
              },
            },
            { provider: "google", signal },
          );

          return asArray(dig(payload, "predictions"))
            .map((item) => ({
              data: asString(dig(item, "bytesBase64Encoded")),
              mime: asString(dig(item, "mimeType")) ?? "image/png",
            }))
            .filter((item) => item.data !== null)
            .map((item) => ({
              url: dataUri(item.mime, item.data as string),
              width: job.width,
              height: job.height,
              mimeType: item.mime,
            }));
        }),
      );
      return chunks.flat();
    }

    const single = async (): Promise<GeneratedImage[]> => {
      const payload = await postJson(
        `${base}/${model.remoteId}:generateContent`,
        {
          headers,
          body: {
            contents: [{ role: "user", parts: [{ text: job.prompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE"],
              imageConfig: { aspectRatio: ratio },
            },
          },
        },
        { provider: "google", signal },
      );

      const parts = asArray(
        dig(asArray(dig(payload, "candidates"))[0], "content", "parts"),
      );
      return parts
        .map((part) => ({
          data: asString(dig(part, "inlineData", "data")),
          mime: asString(dig(part, "inlineData", "mimeType")) ?? "image/png",
        }))
        .filter((part) => part.data !== null)
        .map((part) => ({
          url: dataUri(part.mime, part.data as string),
          width: job.width,
          height: job.height,
          mimeType: part.mime,
        }));
    };

    const results = await Promise.all(
      batches(job.count, 1).map(() => single()),
    );
    return results.flat();
  },
};

/** OpenAI takes the whole batch in one call but only three fixed canvas sizes. */
const openAiImage: ImageProvider = {
  id: "openai",
  kind: "image",
  label: PROVIDER_LABELS.openai,
  models: modelsFor("openai", "image"),
  isConfigured: () => apiKey("openai") !== null,
  async generate(job, model, signal) {
    const key = requireKey("openai");
    const size = nearestRatio(job.width, job.height, OPENAI_SIZES);
    const [renderedWidth, renderedHeight] = size.split("x").map(Number);

    const chunks = await Promise.all(
      batches(job.count, 10).map(async (n) => {
        const payload = await postJson(
          "https://api.openai.com/v1/images/generations",
          {
            headers: { authorization: `Bearer ${key}` },
            body: { model: model.remoteId, prompt: job.prompt, n, size },
          },
          { provider: "openai", signal },
        );

        return asArray(dig(payload, "data"))
          .map((item) => ({
            b64: asString(dig(item, "b64_json")),
            url: asString(dig(item, "url")),
          }))
          .map((item) => ({
            url: item.b64 ? dataUri("image/png", item.b64) : item.url,
            width: renderedWidth,
            height: renderedHeight,
            mimeType: "image/png",
          }))
          .filter((item): item is GeneratedImage => item.url !== null);
      }),
    );
    return chunks.flat();
  },
};

/** Base64 a byte buffer without Node's Buffer, so it also runs on Workers. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

interface ReplicatePrediction {
  status: string;
  output: unknown;
  error: unknown;
  urls?: { get?: string };
}

/**
 * Create a Replicate prediction and wait for it. `Prefer: wait` blocks the
 * create call server-side for the first stretch; anything still running is
 * then polled until the budget runs out. Returns the output file URLs, which
 * Replicate serves publicly — no key needed to fetch them.
 */
async function replicateRun(
  remoteId: string,
  input: Record<string, unknown>,
  signal: AbortSignal | undefined,
  budgetMs: number,
): Promise<string[]> {
  const key = requireKey("replicate");
  let prediction = (await postJson(
    `https://api.replicate.com/v1/models/${remoteId}/predictions`,
    {
      headers: { authorization: `Bearer ${key}`, prefer: "wait=55" },
      body: { input },
    },
    { provider: "replicate", signal, timeoutMs: 60_000 },
  )) as ReplicatePrediction;

  const deadline = Date.now() + budgetMs;
  while (
    (prediction.status === "starting" || prediction.status === "processing") &&
    Date.now() < deadline
  ) {
    await delay(3_000, signal);
    const getUrl = prediction.urls?.get;
    if (!getUrl) break;
    const response = await requestThroughGate(
      "replicate",
      getUrl,
      { method: "GET", headers: { authorization: `Bearer ${key}` } },
      { signal, timeoutMs: 30_000 },
    );
    prediction = (await response.json()) as ReplicatePrediction;
  }

  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new ProviderError(
      "replicate",
      null,
      `replicate ${prediction.status}`,
      String(prediction.error ?? "").slice(0, 500),
    );
  }
  if (prediction.status !== "succeeded") {
    throw new ProviderError("replicate", null, "replicate render timed out");
  }

  const out = prediction.output;
  if (Array.isArray(out)) {
    return out.filter((url): url is string => typeof url === "string");
  }
  return typeof out === "string" ? [out] : [];
}

/**
 * fal.ai serves most models synchronously from `fal.run`, returning the assets
 * on the response. One call can render a whole batch via `num_images`.
 */
const falImage: ImageProvider = {
  id: "fal",
  kind: "image",
  label: PROVIDER_LABELS.fal,
  models: modelsFor("fal", "image"),
  isConfigured: () => apiKey("fal") !== null,
  async generate(job, model, signal) {
    const key = requireKey("fal");
    const payload = await postJson(
      `https://fal.run/${model.remoteId}`,
      {
        headers: { authorization: `Key ${key}` },
        body: {
          prompt: job.prompt,
          image_size: { width: job.width, height: job.height },
          num_images: job.count,
        },
      },
      { provider: "fal", signal, timeoutMs: 120_000 },
    );

    return asArray(dig(payload, "images"))
      .map((item) => ({
        url: asString(dig(item, "url")),
        mime: asString(dig(item, "content_type")) ?? "image/jpeg",
      }))
      .filter((item) => item.url !== null)
      .map((item) => ({
        url: item.url as string,
        width: job.width,
        height: job.height,
        mimeType: item.mime,
      }));
  },
};

/** Replicate hosts community models behind an async prediction API. */
const replicateImage: ImageProvider = {
  id: "replicate",
  kind: "image",
  label: PROVIDER_LABELS.replicate,
  models: modelsFor("replicate", "image"),
  isConfigured: () => apiKey("replicate") !== null,
  async generate(job, model, signal) {
    const urls = await replicateRun(
      model.remoteId,
      { prompt: job.prompt },
      signal,
      50_000,
    );
    if (urls.length === 0) {
      throw new ProviderError("replicate", null, "replicate returned no image");
    }
    return urls.slice(0, job.count).map((url) => ({
      url,
      width: job.width,
      height: job.height,
      mimeType: "image/png",
    }));
  },
};

/** Hugging Face Inference returns the raw image bytes, one per call. */
const huggingFaceImage: ImageProvider = {
  id: "huggingface",
  kind: "image",
  label: PROVIDER_LABELS.huggingface,
  models: modelsFor("huggingface", "image"),
  isConfigured: () => apiKey("huggingface") !== null,
  async generate(job, model, signal) {
    const key = requireKey("huggingface");
    const single = async (): Promise<GeneratedImage> => {
      const response = await requestThroughGate(
        "huggingface",
        `https://api-inference.huggingface.co/models/${model.remoteId}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
            accept: "image/png",
          },
          body: JSON.stringify({ inputs: job.prompt }),
        },
        { signal, timeoutMs: 120_000 },
      );

      const mime = response.headers.get("content-type") ?? "image/png";
      if (mime.includes("json")) {
        throw new ProviderError("huggingface", null, "model is warming up");
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        url: dataUri(mime, bytesToBase64(bytes)),
        width: job.width,
        height: job.height,
        mimeType: mime,
      };
    };

    return Promise.all(batches(job.count, 1).map(() => single()));
  },
};

/** ImageRouter is OpenAI-compatible and fronts a pool of free/open models. */
const imageRouterImage: ImageProvider = {
  id: "imagerouter",
  kind: "image",
  label: PROVIDER_LABELS.imagerouter,
  models: modelsFor("imagerouter", "image"),
  isConfigured: () => apiKey("imagerouter") !== null,
  async generate(job, model, signal) {
    const key = requireKey("imagerouter");
    const payload = await postJson(
      "https://api.imagerouter.io/v1/openai/images/generations",
      {
        headers: { authorization: `Bearer ${key}` },
        body: { model: model.remoteId, prompt: job.prompt },
      },
      { provider: "imagerouter", signal, timeoutMs: 120_000 },
    );

    return asArray(dig(payload, "data"))
      .map((item) => ({
        b64: asString(dig(item, "b64_json")),
        url: asString(dig(item, "url")),
      }))
      .map((item) => ({
        url: item.b64 ? dataUri("image/png", item.b64) : item.url,
        width: job.width,
        height: job.height,
        mimeType: "image/png",
      }))
      .filter((item): item is GeneratedImage => item.url !== null);
  },
};

/* -------------------------------------------------------------------------
   Video providers
   ------------------------------------------------------------------------- */

/**
 * Google Veo through the Gemini API is a long-running operation: submit, poll
 * the operation until done, then pull the sample. The sample URI is fetched
 * server-side with the key and inlined, so the browser never sees the key.
 */
const googleVideo: VideoProvider = {
  id: "google",
  kind: "video",
  label: PROVIDER_LABELS.google,
  models: modelsFor("google", "video"),
  isConfigured: () => apiKey("google") !== null,
  async generate(job, model, signal) {
    const key = requireKey("google");
    const base = "https://generativelanguage.googleapis.com/v1beta";
    const headers = { "x-goog-api-key": key };

    const started = (await postJson(
      `${base}/models/${model.remoteId}:predictLongRunning`,
      {
        headers,
        body: {
          instances: [{ prompt: job.prompt }],
          parameters: { aspectRatio: job.aspectRatio },
        },
      },
      { provider: "google", signal, timeoutMs: 30_000 },
    )) as { name?: string };

    const operation = started.name;
    if (!operation) {
      throw new ProviderError("google", null, "veo did not start");
    }

    const deadline = Date.now() + 170_000;
    let done = false;
    let payload: unknown = null;
    while (!done && Date.now() < deadline) {
      await delay(6_000, signal);
      const response = await requestThroughGate(
        "google",
        `${base}/${operation}`,
        { method: "GET", headers },
        { signal, timeoutMs: 30_000 },
      );
      payload = await response.json();
      done = Boolean(dig(payload, "done"));
    }
    if (!done) {
      throw new ProviderError("google", null, "veo render timed out");
    }

    const samples = asArray(
      dig(payload, "response", "generateVideoResponse", "generatedSamples"),
    );
    const results: GeneratedVideo[] = [];
    for (const sample of samples.slice(0, job.count)) {
      const uri = asString(dig(sample, "video", "uri"));
      if (!uri) continue;
      const file = await requestThroughGate(
        "google",
        uri,
        { method: "GET", headers },
        { signal, timeoutMs: 60_000 },
      );
      const bytes = new Uint8Array(await file.arrayBuffer());
      results.push({
        url: dataUri("video/mp4", bytesToBase64(bytes)),
        durationSeconds: job.durationSeconds,
        mimeType: "video/mp4",
      });
    }
    return results;
  },
};

/** fal.ai video models return a public MP4 URL on the response. */
const falVideo: VideoProvider = {
  id: "fal",
  kind: "video",
  label: PROVIDER_LABELS.fal,
  models: modelsFor("fal", "video"),
  isConfigured: () => apiKey("fal") !== null,
  async generate(job, model, signal) {
    const key = requireKey("fal");
    const body: Record<string, unknown> = {
      prompt: job.prompt,
      aspect_ratio: job.aspectRatio,
      duration: `${job.durationSeconds}s`,
    };
    if (job.imageUrl) body.image_url = job.imageUrl;

    const payload = await postJson(
      `https://fal.run/${model.remoteId}`,
      { headers: { authorization: `Key ${key}` }, body },
      { provider: "fal", signal, timeoutMs: 175_000 },
    );

    const url = asString(dig(payload, "video", "url"));
    if (!url) throw new ProviderError("fal", null, "fal returned no video");
    return [{ url, durationSeconds: job.durationSeconds, mimeType: "video/mp4" }];
  },
};

/** Replicate video models, driven through the same prediction flow as images. */
const replicateVideo: VideoProvider = {
  id: "replicate",
  kind: "video",
  label: PROVIDER_LABELS.replicate,
  models: modelsFor("replicate", "video"),
  isConfigured: () => apiKey("replicate") !== null,
  async generate(job, model, signal) {
    const input: Record<string, unknown> = {
      prompt: job.prompt,
      aspect_ratio: job.aspectRatio,
      duration: job.durationSeconds,
    };
    if (job.imageUrl) input.start_image = job.imageUrl;

    const urls = await replicateRun(model.remoteId, input, signal, 170_000);
    if (urls.length === 0) {
      throw new ProviderError("replicate", null, "replicate returned no video");
    }
    return urls.slice(0, job.count).map((url) => ({
      url,
      durationSeconds: job.durationSeconds,
      mimeType: "video/mp4",
    }));
  },
};

/* -------------------------------------------------------------------------
   Text providers
   ------------------------------------------------------------------------- */

/** OpenAI-compatible chat completions, shared by OpenRouter and OpenAI. */
async function chatCompletion(
  url: string,
  headers: Record<string, string>,
  provider: RemoteProviderId,
  job: TextJob,
  model: ModelSpec,
  signal?: AbortSignal,
): Promise<TextVariant[]> {
  const payload = await postJson(
    url,
    {
      headers,
      body: {
        model: model.remoteId,
        temperature: 0.9,
        max_tokens: job.maxOutputTokens,
        messages: [
          { role: "system", content: job.system },
          { role: "user", content: job.user },
        ],
      },
    },
    { provider, signal },
  );

  const content = asString(
    dig(asArray(dig(payload, "choices"))[0], "message", "content"),
  );
  if (!content) {
    throw new ProviderError(provider, null, `${provider} returned no content`);
  }
  return parseVariants(content, job.count);
}

const openRouterText: TextProvider = {
  id: "openrouter",
  kind: "text",
  label: PROVIDER_LABELS.openrouter,
  models: modelsFor("openrouter", "text"),
  isConfigured: () => apiKey("openrouter") !== null,
  generate: (job, model, signal) =>
    chatCompletion(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        authorization: `Bearer ${requireKey("openrouter")}`,
        "http-referer": process.env.NEXT_PUBLIC_SITE_URL ?? "",
        "x-title": "Socialexie Studio",
      },
      "openrouter",
      job,
      model,
      signal,
    ),
};

const openAiText: TextProvider = {
  id: "openai",
  kind: "text",
  label: PROVIDER_LABELS.openai,
  models: modelsFor("openai", "text"),
  isConfigured: () => apiKey("openai") !== null,
  generate: (job, model, signal) =>
    chatCompletion(
      "https://api.openai.com/v1/chat/completions",
      { authorization: `Bearer ${requireKey("openai")}` },
      "openai",
      job,
      model,
      signal,
    ),
};

const googleText: TextProvider = {
  id: "google",
  kind: "text",
  label: PROVIDER_LABELS.google,
  models: modelsFor("google", "text"),
  isConfigured: () => apiKey("google") !== null,
  async generate(job, model, signal) {
    const payload = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model.remoteId}:generateContent`,
      {
        headers: { "x-goog-api-key": requireKey("google") },
        body: {
          systemInstruction: { parts: [{ text: job.system }] },
          contents: [{ role: "user", parts: [{ text: job.user }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: job.maxOutputTokens,
          },
        },
      },
      { provider: "google", signal },
    );

    const text = asArray(
      dig(asArray(dig(payload, "candidates"))[0], "content", "parts"),
    )
      .map((part) => asString(dig(part, "text")) ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new ProviderError("google", null, "google returned no content");
    }
    return parseVariants(text, job.count);
  },
};

const anthropicText: TextProvider = {
  id: "anthropic",
  kind: "text",
  label: PROVIDER_LABELS.anthropic,
  models: modelsFor("anthropic", "text"),
  isConfigured: () => apiKey("anthropic") !== null,
  async generate(job, model, signal) {
    const payload = await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        headers: {
          "x-api-key": requireKey("anthropic"),
          "anthropic-version": "2023-06-01",
        },
        body: {
          model: model.remoteId,
          max_tokens: job.maxOutputTokens,
          temperature: 1,
          system: job.system,
          messages: [{ role: "user", content: job.user }],
        },
      },
      { provider: "anthropic", signal },
    );

    const text = asArray(dig(payload, "content"))
      .map((block) => asString(dig(block, "text")) ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new ProviderError("anthropic", null, "anthropic returned no content");
    }
    return parseVariants(text, job.count);
  },
};

/* -------------------------------------------------------------------------
   Registry
   ------------------------------------------------------------------------- */

const IMAGE_PROVIDERS: readonly ImageProvider[] = [
  openRouterImage,
  googleImage,
  openAiImage,
  falImage,
  replicateImage,
  huggingFaceImage,
  imageRouterImage,
];

const TEXT_PROVIDERS: readonly TextProvider[] = [
  openRouterText,
  googleText,
  openAiText,
  anthropicText,
];

const VIDEO_PROVIDERS: readonly VideoProvider[] = [
  googleVideo,
  falVideo,
  replicateVideo,
];

export function imageProviderFor(model: ModelSpec): ImageProvider | null {
  return IMAGE_PROVIDERS.find((p) => p.id === model.provider) ?? null;
}

export function textProviderFor(model: ModelSpec): TextProvider | null {
  return TEXT_PROVIDERS.find((p) => p.id === model.provider) ?? null;
}

export function videoProviderFor(model: ModelSpec): VideoProvider | null {
  return VIDEO_PROVIDERS.find((p) => p.id === model.provider) ?? null;
}

type AnyProvider = ImageProvider | TextProvider | VideoProvider;

function providersFor(kind: ModelKind): readonly AnyProvider[] {
  if (kind === "image") return IMAGE_PROVIDERS;
  if (kind === "video") return VIDEO_PROVIDERS;
  return TEXT_PROVIDERS;
}

/** Every model the product knows about, flagged with whether its key is set. */
export function listModelOptions(kind: ModelKind): ModelOption[] {
  return providersFor(kind).flatMap((provider) => {
    const available = provider.isConfigured();
    return provider.models.map((model) => ({ model, available }));
  });
}

/** Models that can actually run right now. */
export function listAvailableModels(kind: ModelKind): ModelSpec[] {
  return providersFor(kind)
    .filter((provider) => provider.isConfigured())
    .flatMap((provider) => provider.models);
}

export function listProviderStatus(): ProviderStatus[] {
  return (Object.keys(KEY_NAMES) as RemoteProviderId[]).map((id) => {
    const kinds: ModelKind[] = [];
    if (modelsFor(id, "image").length > 0) kinds.push("image");
    if (modelsFor(id, "text").length > 0) kinds.push("text");
    if (modelsFor(id, "video").length > 0) kinds.push("video");
    return {
      id,
      label: PROVIDER_LABELS[id],
      configured: apiKey(id) !== null,
      kinds,
    };
  });
}

/* -------------------------------------------------------------------------
   Live model discovery
   ------------------------------------------------------------------------- */

/** One selectable model row, as shown in a connection's model dropdown. */
export interface ModelChoice {
  id: string;
  label: string;
}

export interface DiscoveredModels {
  text: ModelChoice[];
  image: ModelChoice[];
  video: ModelChoice[];
}

const NO_MODELS: DiscoveredModels = { text: [], image: [], video: [] };

/** Soft GET of a provider's model list — returns null instead of throwing. */
async function fetchModelList(
  url: string,
  headers: Record<string, string>,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Turn OpenRouter's per-token pricing into a compact "12K ctx · $x/M" suffix. */
function priceSuffix(
  contextLength: number | undefined,
  promptPerToken: string | null,
  completionPerToken: string | null,
): string {
  const bits: string[] = [];
  if (contextLength && contextLength > 0) {
    bits.push(`${Math.round(contextLength / 1000)}K ctx`);
  }
  const perMillionIn = promptPerToken ? Number(promptPerToken) * 1e6 : NaN;
  const perMillionOut = completionPerToken ? Number(completionPerToken) * 1e6 : NaN;
  if (Number.isFinite(perMillionIn) && perMillionIn > 0) {
    bits.push(`$${perMillionIn.toFixed(2)}/M in`);
  }
  if (Number.isFinite(perMillionOut) && perMillionOut > 0) {
    bits.push(`$${perMillionOut.toFixed(2)}/M out`);
  }
  return bits.length ? ` — ${bits.join(" · ")}` : "";
}

async function discoverOpenRouter(key: string): Promise<DiscoveredModels> {
  const payload = await fetchModelList("https://openrouter.ai/api/v1/models", {
    authorization: `Bearer ${key}`,
  });
  const text: ModelChoice[] = [];
  const image: ModelChoice[] = [];

  for (const row of asArray(dig(payload, "data"))) {
    const id = asString(dig(row, "id"));
    if (!id) continue;
    const name = asString(dig(row, "name")) ?? id;
    const context = Number(dig(row, "context_length")) || undefined;
    const outputs = asArray(dig(row, "architecture", "output_modalities")).filter(
      (value): value is string => typeof value === "string",
    );
    const label =
      name +
      priceSuffix(
        context,
        asString(dig(row, "pricing", "prompt")),
        asString(dig(row, "pricing", "completion")),
      );
    const choice = { id: `openrouter@${id}`, label };
    if (outputs.includes("image")) image.push(choice);
    else text.push(choice);
  }

  return { text: sortChoices(text), image: sortChoices(image), video: [] };
}

async function discoverOpenAi(key: string): Promise<DiscoveredModels> {
  const payload = await fetchModelList("https://api.openai.com/v1/models", {
    authorization: `Bearer ${key}`,
  });
  const text: ModelChoice[] = [];
  const image: ModelChoice[] = [];

  for (const row of asArray(dig(payload, "data"))) {
    const id = asString(dig(row, "id"));
    if (!id) continue;
    if (/embedding|whisper|tts|audio|moderation|realtime|transcribe|search/i.test(id)) {
      continue;
    }
    if (/image|dall-e/i.test(id)) {
      image.push({ id: `openai@${id}`, label: id });
      continue;
    }
    if (/^(gpt-|o1|o3|o4|chatgpt)/i.test(id)) {
      text.push({ id: `openai@${id}`, label: id });
    }
  }

  return { text: sortChoices(text), image: sortChoices(image), video: [] };
}

async function discoverGoogle(key: string): Promise<DiscoveredModels> {
  const payload = await fetchModelList(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    { "x-goog-api-key": key },
  );
  const text: ModelChoice[] = [];
  const image: ModelChoice[] = [];
  const video: ModelChoice[] = [];

  for (const row of asArray(dig(payload, "models"))) {
    const name = asString(dig(row, "name"));
    if (!name) continue;
    const remoteId = name.replace(/^models\//, "");
    const methods = asArray(dig(row, "supportedGenerationMethods")).filter(
      (value): value is string => typeof value === "string",
    );
    const label = asString(dig(row, "displayName")) ?? remoteId;
    const choice = { id: `google@${remoteId}`, label };

    if (/veo/i.test(remoteId)) video.push(choice);
    else if (/imagen/i.test(remoteId) || /image/i.test(remoteId)) image.push(choice);
    else if (methods.includes("generateContent") && /gemini/i.test(remoteId) && !/embedding/i.test(remoteId)) {
      text.push(choice);
    }
  }

  return {
    text: sortChoices(text),
    image: sortChoices(image),
    video: sortChoices(video),
  };
}

async function discoverAnthropic(key: string): Promise<DiscoveredModels> {
  const payload = await fetchModelList("https://api.anthropic.com/v1/models", {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  });
  const text: ModelChoice[] = [];

  for (const row of asArray(dig(payload, "data"))) {
    const id = asString(dig(row, "id"));
    if (!id) continue;
    text.push({ id: `anthropic@${id}`, label: asString(dig(row, "display_name")) ?? id });
  }

  return { text, image: [], video: [] };
}

function sortChoices(choices: ModelChoice[]): ModelChoice[] {
  return [...choices].sort((a, b) => a.label.localeCompare(b.label));
}

/** Which providers expose a usable "list my models" endpoint. */
export function isDiscoverable(provider: RemoteProviderId): boolean {
  return (
    provider === "openrouter" ||
    provider === "openai" ||
    provider === "google" ||
    provider === "anthropic"
  );
}

/**
 * Pull a provider's live catalogue with the workspace's own key, so the model
 * dropdowns show everything the account can actually reach — not just the
 * curated defaults. Any failure degrades to an empty result, and the caller
 * keeps the static catalogue.
 */
export async function discoverModels(
  provider: RemoteProviderId,
  key: string,
): Promise<DiscoveredModels> {
  try {
    if (provider === "openrouter") return await discoverOpenRouter(key);
    if (provider === "openai") return await discoverOpenAi(key);
    if (provider === "google") return await discoverGoogle(key);
    if (provider === "anthropic") return await discoverAnthropic(key);
  } catch {
    // fall through to the empty result
  }
  return NO_MODELS;
}

function costOf(model: ModelSpec): number {
  return (
    model.approxCentsPerImage ??
    model.approxCentsPerMTok ??
    model.approxCentsPerSecond ??
    Number.MAX_SAFE_INTEGER
  );
}

const REMOTE_IDS = new Set<string>(Object.keys(KEY_NAMES));

/**
 * A model chosen from a provider's *live* catalogue rather than the curated
 * one. The dropdown encodes such a pick as `provider@remoteId`, which we turn
 * into an on-the-fly spec so any model the provider offers is routable — this
 * is what lets a connected OpenRouter key drive its full model list, not just
 * the handful we ship by default.
 */
function ephemeralModel(kind: ModelKind, requestedId: string): ModelSpec | null {
  const at = requestedId.indexOf("@");
  if (at <= 0) return null;

  const provider = requestedId.slice(0, at);
  const remoteId = requestedId.slice(at + 1);
  if (!REMOTE_IDS.has(provider) || !remoteId) return null;

  const id = provider as RemoteProviderId;
  const serves = providersFor(kind).some(
    (candidate) => candidate.id === id && candidate.isConfigured(),
  );
  if (!serves) return null;

  return {
    id: requestedId,
    label: remoteId,
    provider: id,
    kind,
    remoteId,
    capabilities: [],
  };
}

/**
 * Pick the model to run. A live catalogue pick (`provider@remoteId`) is honoured
 * directly; otherwise an unknown or unconfigured request falls back to the
 * cheapest curated model that is actually wired up rather than failing the call.
 */
export function resolveModel(
  kind: ModelKind,
  requestedId?: string,
): ModelSpec | null {
  if (requestedId) {
    const live = ephemeralModel(kind, requestedId);
    if (live) return live;
  }

  const available = listAvailableModels(kind);
  if (available.length === 0) return null;

  if (requestedId) {
    const exact = available.find((model) => model.id === requestedId);
    if (exact) return exact;
  }

  return available.reduce((best, model) =>
    costOf(model) < costOf(best) ? model : best,
  );
}

/**
 * The primary model, then the cheapest available model from every *other*
 * configured provider. Retrying the same vendor after a 5xx rarely helps;
 * crossing to a different one usually does.
 */
export function fallbackChain(kind: ModelKind, primary: ModelSpec): ModelSpec[] {
  const alternates = new Map<ProviderId, ModelSpec>();

  for (const model of listAvailableModels(kind)) {
    if (model.provider === primary.provider) continue;
    const current = alternates.get(model.provider);
    if (!current || costOf(model) < costOf(current)) {
      alternates.set(model.provider, model);
    }
  }

  return [
    primary,
    ...[...alternates.values()].sort((a, b) => costOf(a) - costOf(b)),
  ];
}

export interface ChainOutcome<T> {
  value: T;
  model: ModelSpec;
  attempts: ProviderFailure[];
}

/**
 * Walk the fallback chain until one model succeeds, keeping a record of what
 * went wrong on the way so the route can log an accurate trail.
 */
export async function runChain<T>(
  chain: readonly ModelSpec[],
  execute: (model: ModelSpec) => Promise<T>,
): Promise<ChainOutcome<T>> {
  const attempts: ProviderFailure[] = [];

  for (const model of chain) {
    try {
      return { value: await execute(model), model, attempts };
    } catch (error) {
      const message =
        error instanceof ProviderError
          ? `${error.message}${error.detail ? ` — ${error.detail}` : ""}`
          : error instanceof Error
            ? error.message
            : "unknown failure";
      attempts.push({ provider: model.provider, model: model.id, message });
    }
  }

  throw new NoProviderError(attempts);
}

function mimeFromDataUri(url: string): string {
  const match = /^data:([^;,]+)/.exec(url);
  return match ? match[1] : "image/png";
}
