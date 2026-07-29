import "server-only";

import {
  NoProviderError,
  ProviderError,
  type GeneratedImage,
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
};

function apiKey(provider: RemoteProviderId): string | null {
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
};

function modelsFor(provider: RemoteProviderId, kind: ModelKind): ModelSpec[] {
  const catalogue = kind === "image" ? IMAGE_MODELS : TEXT_MODELS;
  return catalogue.filter((model) => model.provider === provider);
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
];

const TEXT_PROVIDERS: readonly TextProvider[] = [
  openRouterText,
  googleText,
  openAiText,
  anthropicText,
];

export function imageProviderFor(model: ModelSpec): ImageProvider | null {
  return IMAGE_PROVIDERS.find((p) => p.id === model.provider) ?? null;
}

export function textProviderFor(model: ModelSpec): TextProvider | null {
  return TEXT_PROVIDERS.find((p) => p.id === model.provider) ?? null;
}

function providersFor(kind: ModelKind): readonly (ImageProvider | TextProvider)[] {
  return kind === "image" ? IMAGE_PROVIDERS : TEXT_PROVIDERS;
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
    return {
      id,
      label: PROVIDER_LABELS[id],
      configured: apiKey(id) !== null,
      kinds,
    };
  });
}

function costOf(model: ModelSpec): number {
  return (
    model.approxCentsPerImage ?? model.approxCentsPerMTok ?? Number.MAX_SAFE_INTEGER
  );
}

/**
 * Pick the model to run. An unknown or unconfigured request falls back to the
 * cheapest thing that is actually wired up rather than failing the call.
 */
export function resolveModel(
  kind: ModelKind,
  requestedId?: string,
): ModelSpec | null {
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
