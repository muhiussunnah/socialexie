import "server-only";

import { z } from "zod";
import {
  fallbackChain,
  resolveModel,
  runChain,
  videoProviderFor,
} from "@/lib/ai/providers";
import {
  ProviderError,
  type GeneratedVideo,
  type ModelSpec,
  type VideoJob,
  type VideoRequest,
  type VideoResult,
} from "@/lib/ai/types";

/** Video generation entry point: validate, route, generate, degrade. */

export const MAX_VIDEO_BATCH = 2;
export const DEFAULT_DURATION_SECONDS = 6;
export const ASPECT_RATIOS = ["16:9", "9:16", "1:1"] as const;

export const videoRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Describe the shot you want")
    .max(2000, "Prompt must be 2000 characters or fewer"),
  style: z.string().trim().max(400, "Style must be 400 characters or fewer").optional(),
  durationSeconds: z.number().int().min(2).max(30).optional(),
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
  imageUrl: z.string().trim().max(2_000_000).optional(),
  count: z
    .number()
    .int()
    .min(1, "Generate at least one clip")
    .max(MAX_VIDEO_BATCH, `Generate at most ${MAX_VIDEO_BATCH} clips`)
    .optional(),
  modelId: z.string().trim().max(120).optional(),
});

export type VideoRequestInput = z.infer<typeof videoRequestSchema>;

export function normalizeVideoRequest(input: VideoRequestInput): VideoRequest {
  return {
    prompt: input.prompt,
    style: input.style || undefined,
    durationSeconds: input.durationSeconds ?? DEFAULT_DURATION_SECONDS,
    aspectRatio: input.aspectRatio ?? "9:16",
    imageUrl: input.imageUrl || undefined,
    count: input.count ?? 1,
    modelId: input.modelId || undefined,
  };
}

export function estimateVideoCents(model: ModelSpec, job: VideoJob): number {
  const perSecond = model.approxCentsPerSecond ?? 0;
  return Math.max(1, Math.round(perSecond * job.durationSeconds * job.count));
}

export const SIMULATED_VIDEO_MODEL: ModelSpec = {
  id: "simulated/placeholder",
  label: "Placeholder renderer",
  provider: "simulated",
  kind: "video",
  remoteId: "placeholder",
  capabilities: ["text-to-video"],
  approxCentsPerSecond: 0,
};

/** Fold style into the prompt; every provider takes one prompt string. */
function composePrompt(request: VideoRequest): string {
  const parts = [request.prompt];
  if (request.style) parts.push(`Art direction: ${request.style}.`);
  parts.push(`Framed ${request.aspectRatio}, about ${request.durationSeconds}s.`);
  return parts.join(" ");
}

export async function generateVideo(
  request: VideoRequest,
  options: { signal?: AbortSignal } = {},
): Promise<VideoResult> {
  const startedAt = Date.now();
  const model = resolveModel("video", request.modelId);

  const job: VideoJob = {
    prompt: composePrompt(request),
    durationSeconds: request.durationSeconds ?? DEFAULT_DURATION_SECONDS,
    aspectRatio: request.aspectRatio ?? "9:16",
    imageUrl: request.imageUrl,
    count: request.count,
  };

  if (!model) {
    return {
      videos: Array.from({ length: request.count }, (_, index) =>
        placeholderVideo(job, index),
      ),
      model: SIMULATED_VIDEO_MODEL,
      simulated: true,
      attempts: [],
      elapsedMs: Date.now() - startedAt,
      estimatedCents: 0,
    };
  }

  const outcome = await runChain(fallbackChain("video", model), (candidate) => {
    const provider = videoProviderFor(candidate);
    if (!provider) {
      return Promise.reject(
        new ProviderError(candidate.provider, null, "provider not registered"),
      );
    }
    return provider.generate(job, candidate, options.signal).then((videos) => {
      if (videos.length === 0) {
        throw new ProviderError(
          candidate.provider,
          null,
          "provider returned no clips",
        );
      }
      return videos;
    });
  });

  return {
    videos: outcome.value,
    model: outcome.model,
    simulated: false,
    attempts: outcome.attempts,
    elapsedMs: Date.now() - startedAt,
    estimatedCents: estimateVideoCents(outcome.model, job),
  };
}

/**
 * A tiny labelled SVG "poster" so the studio can demonstrate the flow with no
 * key present. There is no placeholder motion — it reads as a stand-in on
 * purpose, mirroring the image renderer's approach.
 */
function placeholderVideo(job: VideoJob, index: number): GeneratedVideo {
  const [w, h] = ({ "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [900, 900] } as const)[
    job.aspectRatio as "16:9" | "9:16" | "1:1"
  ] ?? [720, 1280];

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Simulated video preview">` +
    `<rect width="${w}" height="${h}" fill="#14161a"/>` +
    `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.1}" fill="none" stroke="#b8730a" stroke-width="6"/>` +
    `<path d="M ${w / 2 - 16} ${h / 2 - 26} L ${w / 2 + 30} ${h / 2} L ${w / 2 - 16} ${h / 2 + 26} Z" fill="#b8730a"/>` +
    `<text x="${w / 2}" y="${h * 0.72}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="${Math.round(Math.min(w, h) * 0.045)}" fill="#f4f1ec" fill-opacity="0.9">Simulated clip #${index + 1}</text>` +
    `<text x="${w / 2}" y="${h * 0.78}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="${Math.round(Math.min(w, h) * 0.03)}" fill="#ffffff" fill-opacity="0.5">Connect a video provider key to render</text>` +
    `</svg>`;

  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width: w,
    height: h,
    durationSeconds: job.durationSeconds,
    mimeType: "image/svg+xml",
    posterUrl: undefined,
  };
}
