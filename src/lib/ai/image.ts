import "server-only";

import { z } from "zod";
import {
  fallbackChain,
  imageProviderFor,
  resolveModel,
  runChain,
} from "@/lib/ai/providers";
import {
  ProviderError,
  type GeneratedImage,
  type ImageJob,
  type ImageRequest,
  type ImageResult,
  type ModelSpec,
} from "@/lib/ai/types";
import { CUSTOM_SIZE_BOUNDS, SIZE_PRESETS, clampDimension } from "@/lib/platforms";

/** Image generation entry point: validate, route, generate, degrade. */

export const DEFAULT_IMAGE_SIZE = { width: 1080, height: 1350 } as const;
export const MAX_BATCH = 8;

const dimension = z
  .number()
  .int("Dimensions must be whole pixels")
  .min(CUSTOM_SIZE_BOUNDS.min, `Minimum ${CUSTOM_SIZE_BOUNDS.min}px`)
  .max(CUSTOM_SIZE_BOUNDS.max, `Maximum ${CUSTOM_SIZE_BOUNDS.max}px`);

export const imageRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Describe the image you want")
    .max(2000, "Prompt must be 2000 characters or fewer"),
  style: z.string().trim().max(400, "Style must be 400 characters or fewer").optional(),
  negativePrompt: z
    .string()
    .trim()
    .max(400, "Negative prompt must be 400 characters or fewer")
    .optional(),
  width: dimension.optional(),
  height: dimension.optional(),
  count: z
    .number()
    .int()
    .min(1, "Generate at least one image")
    .max(MAX_BATCH, `Generate at most ${MAX_BATCH} images`)
    .optional(),
  modelId: z.string().trim().max(120).optional(),
});

export type ImageRequestInput = z.infer<typeof imageRequestSchema>;

/**
 * A canonical platform size is never snapped. Instagram's portrait feed is
 * 1080x1350, and rounding that to the models' multiple-of-8 grid would hand
 * back 1080x1352 — technically valid, but no longer the size the preset
 * promised.
 */
function isCanonicalSize(width: number, height: number): boolean {
  return SIZE_PRESETS.some((p) => p.width === width && p.height === height);
}

/** Apply defaults and snap the canvas to a size the models accept. */
export function normalizeImageRequest(input: ImageRequestInput): ImageRequest {
  const requestedWidth = input.width ?? DEFAULT_IMAGE_SIZE.width;
  const requestedHeight = input.height ?? DEFAULT_IMAGE_SIZE.height;
  const canonical = isCanonicalSize(requestedWidth, requestedHeight);

  return {
    prompt: input.prompt,
    style: input.style || undefined,
    negativePrompt: input.negativePrompt || undefined,
    width: canonical ? requestedWidth : clampDimension(requestedWidth),
    height: canonical ? requestedHeight : clampDimension(requestedHeight),
    count: input.count ?? 1,
    modelId: input.modelId || undefined,
  };
}

export function estimateImageCents(model: ModelSpec, count: number): number {
  return Math.round((model.approxCentsPerImage ?? 0) * count);
}

/** The model stand-in reported when nothing is configured. */
export const SIMULATED_IMAGE_MODEL: ModelSpec = {
  id: "simulated/placeholder",
  label: "Placeholder renderer",
  provider: "simulated",
  kind: "image",
  remoteId: "placeholder",
  capabilities: ["text-to-image"],
  approxCentsPerImage: 0,
};

/**
 * Fold style and negative direction into a single instruction. Every provider
 * takes one prompt string, so this is the only place the wording is decided.
 */
function composePrompt(request: ImageRequest): string {
  const parts = [request.prompt];
  if (request.style) parts.push(`Art direction: ${request.style}.`);
  parts.push(
    `Compose for a ${request.width}x${request.height} pixel canvas ` +
      `(${aspectLabel(request.width, request.height)}).`,
  );
  if (request.negativePrompt) parts.push(`Avoid: ${request.negativePrompt}.`);
  return parts.join(" ");
}

export async function generateImage(
  request: ImageRequest,
  options: { signal?: AbortSignal } = {},
): Promise<ImageResult> {
  const startedAt = Date.now();
  const model = resolveModel("image", request.modelId);

  if (!model) {
    return {
      images: Array.from({ length: request.count }, (_, index) =>
        placeholderImage(request, index),
      ),
      model: SIMULATED_IMAGE_MODEL,
      simulated: true,
      attempts: [],
      elapsedMs: Date.now() - startedAt,
      estimatedCents: 0,
    };
  }

  const job: ImageJob = {
    prompt: composePrompt(request),
    width: request.width,
    height: request.height,
    count: request.count,
  };

  const outcome = await runChain(fallbackChain("image", model), (candidate) => {
    const provider = imageProviderFor(candidate);
    if (!provider) {
      return Promise.reject(
        new ProviderError(candidate.provider, null, "provider not registered"),
      );
    }
    return provider.generate(job, candidate, options.signal).then((images) => {
      if (images.length === 0) {
        throw new ProviderError(
          candidate.provider,
          null,
          "provider returned no images",
        );
      }
      return images;
    });
  });

  return {
    images: outcome.value,
    model: outcome.model,
    simulated: false,
    attempts: outcome.attempts,
    elapsedMs: Date.now() - startedAt,
    estimatedCents: estimateImageCents(outcome.model, outcome.value.length),
  };
}

/* -------------------------------------------------------------------------
   Placeholder renderer
   ------------------------------------------------------------------------- */

/**
 * Deterministic stand-in used when no provider key is present, so the studio is
 * fully explorable on a fresh clone. The colours are baked into the SVG rather
 * than read from the theme tokens because the result is image *content* — it
 * gets downloaded and attached to posts, where no stylesheet follows it.
 */
function placeholderImage(request: ImageRequest, index: number): GeneratedImage {
  const { width, height } = request;
  const seed = hashString(`${request.prompt}|${request.style ?? ""}|${width}x${height}|${index}`);
  const hue = seed % 360;
  const scale = Math.max(width, height) / 1000;

  const pad = Math.round(48 * scale);
  const chipSize = Math.round(20 * scale);
  const bodySize = Math.round(30 * scale);
  const metaSize = Math.round(22 * scale);
  const columns = Math.max(16, Math.floor(width / (bodySize * 0.54)));
  const lines = wrapText(request.prompt, columns, 5);

  const body = lines
    .map(
      (line, row) =>
        `<text x="${pad}" y="${pad + chipSize * 3 + row * bodySize * 1.35}" ` +
        `font-size="${bodySize}" fill="#f4f1ec" fill-opacity="0.94">${escapeXml(line)}</text>`,
    )
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" aria-label="Simulated preview">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},46%,17%)"/>` +
    `<stop offset="1" stop-color="hsl(${(hue + 48) % 360},52%,8%)"/>` +
    `</linearGradient>` +
    `<pattern id="grid" width="${Math.round(72 * scale)}" height="${Math.round(72 * scale)}" patternUnits="userSpaceOnUse">` +
    `<path d="M ${Math.round(72 * scale)} 0 L 0 0 0 ${Math.round(72 * scale)}" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="1"/>` +
    `</pattern>` +
    `</defs>` +
    `<rect width="${width}" height="${height}" fill="url(#bg)"/>` +
    `<rect width="${width}" height="${height}" fill="url(#grid)"/>` +
    `<rect x="${pad / 2}" y="${pad / 2}" width="${width - pad}" height="${height - pad}" ` +
    `rx="${Math.round(18 * scale)}" fill="none" stroke="#ffffff" stroke-opacity="0.16"/>` +
    `<g font-family="ui-sans-serif, system-ui, -apple-system, sans-serif">` +
    `<text x="${pad}" y="${pad + chipSize}" font-size="${chipSize}" letter-spacing="${2 * scale}" ` +
    `font-weight="700" fill="hsl(${hue},80%,74%)">SIMULATED PREVIEW</text>` +
    body +
    `<text x="${pad}" y="${height - pad - metaSize * 1.5}" font-size="${metaSize}" ` +
    `font-family="ui-monospace, monospace" fill="#ffffff" fill-opacity="0.62">` +
    `${width} x ${height} · ${escapeXml(aspectLabel(width, height))} · #${index + 1}</text>` +
    `<text x="${pad}" y="${height - pad}" font-size="${metaSize}" fill="#ffffff" fill-opacity="0.42">` +
    `No model provider key configured</text>` +
    `</g></svg>`;

  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width,
    height,
    mimeType: "image/svg+xml",
  };
}

export function aspectLabel(width: number, height: number): string {
  const divisor = greatestCommonDivisor(width, height) || 1;
  const w = width / divisor;
  const h = height / divisor;
  if (w <= 40 && h <= 40) return `${w}:${h}`;
  const ratio = width / height;
  return ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(1 / ratio).toFixed(2)}`;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return Math.abs(hash);
}

function wrapText(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let index = 0;

  for (; index < words.length; index++) {
    const candidate = current ? `${current} ${words[index]}` : words[index];
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (lines.length === maxLines) break;
    current = words[index];
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
    index = words.length;
  }

  if (index < words.length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = `${last.slice(0, Math.max(1, maxChars - 1))}…`;
  }

  return lines;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
