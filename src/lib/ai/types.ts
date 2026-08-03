/**
 * Contracts shared by the provider implementations, the router, the API routes
 * and the studio UI.
 *
 * Nothing in here touches the network or reads `process.env`, so a client
 * component can safely `import type` from this module.
 */

import type { PlatformId } from "@/lib/platforms";

export type ModelKind = "image" | "text" | "video";

/** `simulated` is not a vendor — it marks placeholder output. */
export type ProviderId =
  | "openrouter"
  | "google"
  | "openai"
  | "anthropic"
  | "fal"
  | "replicate"
  | "huggingface"
  | "imagerouter"
  | "simulated";

export type RemoteProviderId = Exclude<ProviderId, "simulated">;

export type Capability =
  | "text-to-image"
  | "image-edit"
  | "aspect-control"
  | "typography"
  | "text-to-video"
  | "image-to-video"
  | "chat"
  | "long-context"
  | "json-output";

export interface ModelSpec {
  /** Stable id used by the API and persisted with a generation. */
  id: string;
  label: string;
  provider: ProviderId;
  kind: ModelKind;
  capabilities: readonly Capability[];
  /** Identifier the upstream API expects, which rarely matches `id`. */
  remoteId: string;
  maxWidth?: number;
  maxHeight?: number;
  /** Rough list price, for the pre-flight estimate only. Never billed from. */
  approxCentsPerImage?: number;
  approxCentsPerMTok?: number;
  approxCentsPerSecond?: number;
  /** Longest clip a video model will render, in seconds. */
  maxDurationSeconds?: number;
}

/** A model plus whether its provider currently has a key. */
export interface ModelOption {
  model: ModelSpec;
  available: boolean;
}

export interface ProviderStatus {
  id: RemoteProviderId;
  label: string;
  configured: boolean;
  kinds: readonly ModelKind[];
}

/* -------------------------------------------------------------------------
   Requests
   ------------------------------------------------------------------------- */

/** A validated image request, before the prompt is composed. */
export interface ImageRequest {
  prompt: string;
  style?: string;
  negativePrompt?: string;
  width: number;
  height: number;
  count: number;
  modelId?: string;
}

/** A validated caption request. */
export interface TextRequest {
  prompt: string;
  tone?: string;
  platform?: PlatformId;
  count: number;
  maxChars?: number;
  modelId?: string;
}

/** A validated video request, before the prompt is composed. */
export interface VideoRequest {
  prompt: string;
  style?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  /** Data URI or URL of a still to animate, for image-to-video models. */
  imageUrl?: string;
  count: number;
  modelId?: string;
}

/**
 * What a provider actually receives. Composing the prompt once, up front, keeps
 * every provider mapping down to request shape and response shape.
 */
export interface ImageJob {
  prompt: string;
  width: number;
  height: number;
  count: number;
}

export interface TextJob {
  system: string;
  user: string;
  count: number;
  maxOutputTokens: number;
}

export interface VideoJob {
  prompt: string;
  durationSeconds: number;
  aspectRatio: string;
  imageUrl?: string;
  count: number;
}

/* -------------------------------------------------------------------------
   Results
   ------------------------------------------------------------------------- */

export interface GeneratedImage {
  /** `data:` URI or remote URL, ready for an `<img src>`. */
  url: string;
  width: number;
  height: number;
  mimeType: string;
}

export interface TextVariant {
  text: string;
  characters: number;
}

export interface GeneratedVideo {
  /** `data:` URI or remote URL, ready for a `<video src>`. */
  url: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  mimeType: string;
  /** Optional still frame for a lightweight preview. */
  posterUrl?: string;
}

/** One provider that was tried and failed before the chain moved on. */
export interface ProviderFailure {
  provider: ProviderId;
  model: string;
  message: string;
}

interface ResultBase {
  model: ModelSpec;
  /** True when the payload is a placeholder rather than model output. */
  simulated: boolean;
  attempts: readonly ProviderFailure[];
  elapsedMs: number;
  estimatedCents: number;
}

export interface ImageResult extends ResultBase {
  images: GeneratedImage[];
}

export interface TextResult extends ResultBase {
  variants: TextVariant[];
}

export interface VideoResult extends ResultBase {
  videos: GeneratedVideo[];
}

/* -------------------------------------------------------------------------
   Providers
   ------------------------------------------------------------------------- */

interface ProviderBase {
  id: RemoteProviderId;
  label: string;
  models: readonly ModelSpec[];
  isConfigured(): boolean;
}

export interface ImageProvider extends ProviderBase {
  kind: "image";
  generate(
    job: ImageJob,
    model: ModelSpec,
    signal?: AbortSignal,
  ): Promise<GeneratedImage[]>;
}

export interface TextProvider extends ProviderBase {
  kind: "text";
  generate(
    job: TextJob,
    model: ModelSpec,
    signal?: AbortSignal,
  ): Promise<TextVariant[]>;
}

export interface VideoProvider extends ProviderBase {
  kind: "video";
  generate(
    job: VideoJob,
    model: ModelSpec,
    signal?: AbortSignal,
  ): Promise<GeneratedVideo[]>;
}

/**
 * Upstream failure. Carries the provider so the router can attribute the error,
 * and a `detail` that stays server-side — it can contain echoed request data.
 */
export class ProviderError extends Error {
  readonly provider: ProviderId;
  readonly status: number | null;
  readonly detail: string | null;

  constructor(
    provider: ProviderId,
    status: number | null,
    message: string,
    detail: string | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.status = status;
    this.detail = detail;
  }
}

/** Raised when every provider in the fallback chain rejected the job. */
export class NoProviderError extends Error {
  readonly attempts: readonly ProviderFailure[];

  constructor(attempts: readonly ProviderFailure[]) {
    super(
      attempts.length === 0
        ? "No provider is configured"
        : `All ${attempts.length} configured providers failed`,
    );
    this.name = "NoProviderError";
    this.attempts = attempts;
  }
}

/** Envelope every AI route returns, so the client has one shape to narrow on. */
export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
