import "server-only";

import { z } from "zod";
import {
  fallbackChain,
  resolveModel,
  runChain,
  textProviderFor,
} from "@/lib/ai/providers";
import {
  ProviderError,
  type ModelSpec,
  type TextJob,
  type TextRequest,
  type TextResult,
} from "@/lib/ai/types";
import { PLATFORM_IDS, getPlatform } from "@/lib/platforms";

/** Caption generation entry point: validate, route, generate, degrade. */

export const MAX_VARIANTS = 8;
const DEFAULT_CHAR_LIMIT = 600;

export const textRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Describe what the post is about")
    .max(2000, "Prompt must be 2000 characters or fewer"),
  tone: z.string().trim().max(400, "Brand voice must be 400 characters or fewer").optional(),
  platform: z.enum(PLATFORM_IDS).optional(),
  count: z
    .number()
    .int()
    .min(1, "Write at least one option")
    .max(MAX_VARIANTS, `Write at most ${MAX_VARIANTS} options`)
    .optional(),
  maxChars: z.number().int().min(40).max(5_000).optional(),
  modelId: z.string().trim().max(120).optional(),
});

export type TextRequestInput = z.infer<typeof textRequestSchema>;

export function normalizeTextRequest(input: TextRequestInput): TextRequest {
  return {
    prompt: input.prompt,
    tone: input.tone || undefined,
    platform: input.platform,
    count: input.count ?? 3,
    maxChars: input.maxChars,
    modelId: input.modelId || undefined,
  };
}

/** Characters a single option may use, tightest of the caller and the network. */
export function characterBudget(request: TextRequest): number {
  const platformLimit = request.platform
    ? getPlatform(request.platform).captionLimit
    : DEFAULT_CHAR_LIMIT;
  return Math.min(request.maxChars ?? DEFAULT_CHAR_LIMIT, platformLimit);
}

export function estimateTextCents(model: ModelSpec, count: number): number {
  // ~700 tokens of prompt plus ~180 per option, priced off the blended rate.
  const tokens = 700 + count * 180;
  return Math.max(1, Math.round(((model.approxCentsPerMTok ?? 0) * tokens) / 1_000_000));
}

export const SIMULATED_TEXT_MODEL: ModelSpec = {
  id: "simulated/placeholder",
  label: "Placeholder writer",
  provider: "simulated",
  kind: "text",
  remoteId: "placeholder",
  capabilities: ["chat"],
  approxCentsPerMTok: 0,
};

/**
 * The publishing rules live in the platform registry, so the brief the model
 * receives is derived from them rather than restated here.
 */
function buildJob(request: TextRequest): TextJob {
  const limit = characterBudget(request);
  const platform = request.platform ? getPlatform(request.platform) : null;

  const system = [
    "You write social copy for a scheduling tool used by brand teams.",
    `Return exactly ${request.count} distinct option${request.count === 1 ? "" : "s"}.`,
    `Every option must be ${limit} characters or fewer, including hashtags.`,
    platform ? `Target network: ${platform.name}.` : "Keep the copy network-agnostic.",
    platform?.maxHashtags
      ? `Use at most ${platform.maxHashtags} hashtags.`
      : "Use hashtags sparingly.",
    request.tone ? `Brand voice: ${request.tone}` : null,
    "Vary the hook across options — do not restate the same opening.",
    'Reply with a JSON array of strings and nothing else, e.g. ["first", "second"].',
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    system,
    user: request.prompt,
    count: request.count,
    maxOutputTokens: Math.min(4_000, 220 + request.count * Math.ceil(limit / 2)),
  };
}

export async function generateText(
  request: TextRequest,
  options: { signal?: AbortSignal } = {},
): Promise<TextResult> {
  const startedAt = Date.now();
  const model = resolveModel("text", request.modelId);

  if (!model) {
    return {
      variants: placeholderVariants(request),
      model: SIMULATED_TEXT_MODEL,
      simulated: true,
      attempts: [],
      elapsedMs: Date.now() - startedAt,
      estimatedCents: 0,
    };
  }

  const job = buildJob(request);

  const outcome = await runChain(fallbackChain("text", model), (candidate) => {
    const provider = textProviderFor(candidate);
    if (!provider) {
      return Promise.reject(
        new ProviderError(candidate.provider, null, "provider not registered"),
      );
    }
    return provider.generate(job, candidate, options.signal).then((variants) => {
      if (variants.length === 0) {
        throw new ProviderError(
          candidate.provider,
          null,
          "provider returned no options",
        );
      }
      return variants;
    });
  });

  return {
    variants: outcome.value,
    model: outcome.model,
    simulated: false,
    attempts: outcome.attempts,
    elapsedMs: Date.now() - startedAt,
    estimatedCents: estimateTextCents(outcome.model, outcome.value.length),
  };
}

/**
 * Clearly-labelled stand-in copy so the studio still demonstrates the flow with
 * no keys present. These read as placeholders on purpose.
 */
function placeholderVariants(request: TextRequest) {
  const limit = characterBudget(request);
  const subject = request.prompt.replace(/\s+/g, " ").trim();
  const angles = [
    "Hook",
    "Story",
    "Question",
    "List",
    "Contrast",
    "Proof",
    "Invitation",
    "Recap",
  ];

  return Array.from({ length: request.count }, (_, index) => {
    const text = (
      `[Simulated ${angles[index % angles.length].toLowerCase()} draft] ${subject} — ` +
      `add a provider key to generate real copy for this brief.`
    ).slice(0, limit);
    return { text, characters: text.length };
  });
}
