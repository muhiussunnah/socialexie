import "server-only";

import { z } from "zod";
import {
  fallbackChain,
  resolveModel,
  runChain,
  textProviderFor,
} from "@/lib/ai/providers";
import { ProviderError, type TextJob, type TextVariant } from "@/lib/ai/types";
import { PLATFORM_IDS, getPlatform } from "@/lib/platforms";

/**
 * Viral finder: given a niche and a network, surface the content patterns that
 * are working there right now — as ideas to riff on, with the signal each one
 * maximises. This is deliberately idea generation, not scraping: it never
 * claims to show real posts, real accounts or real view counts, so there is
 * nothing to download and nothing fabricated as fact. It runs on the signed-in
 * workspace's own AI key through the same provider chain as the rest of the
 * studio.
 */

export const viralRequestSchema = z.object({
  platform: z.enum(PLATFORM_IDS),
  niche: z
    .string()
    .trim()
    .min(2, "Tell it your niche")
    .max(120, "Keep the niche under 120 characters"),
});

export type ViralRequestInput = z.infer<typeof viralRequestSchema>;

export interface ViralIdea {
  hook: string;
  format: string;
  signal: string;
  effort: string;
  why: string;
}

export interface ViralResult {
  ideas: ViralIdea[];
  simulated: boolean;
  model: string;
}

const COUNT = 8;
const DELIM = "~|";

function buildJob(platformName: string, niche: string): TextJob {
  const system = [
    `You are a social media strategist. Analyse what is making content go viral for the "${niche}" niche on ${platformName} right now, and return ${COUNT} distinct, currently-working content ideas.`,
    `Return each idea as ONE string with exactly five fields separated by " ${DELIM} " in this order:`,
    `hook ${DELIM} format ${DELIM} signal ${DELIM} effort ${DELIM} why`,
    `- hook: a scroll-stopping opening line or concept a creator could use.`,
    `- format: one of Reel, Carousel, Short, Story, Text, Live.`,
    `- signal: the single metric it maximises — one of Saves, Shares, Comments, Watch-through.`,
    `- effort: how hard it is to produce — Low, Medium, or High.`,
    `- why: one short sentence on why it spreads.`,
    `Reply with a JSON array of exactly ${COUNT} such strings and nothing else.`,
    `Do NOT invent real accounts, real post links, or specific view counts — these are idea patterns for inspiration, not real posts.`,
  ].join("\n");

  return {
    system,
    user: `Niche: ${niche}. Platform: ${platformName}.`,
    count: COUNT,
    maxOutputTokens: 1_600,
  };
}

/** Strip the JSON scaffolding a model sometimes leaks into a field. */
function clean(value: string | undefined): string {
  return (value ?? "")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/^[\s\[\]"',]+/, "")
    .replace(/[\s\[\]"',\\]+$/, "")
    .trim();
}

/** Split the delimited model output into structured cards; drop malformed rows. */
function parseIdeas(variants: TextVariant[]): ViralIdea[] {
  return variants
    .map((variant) => variant.text.split(DELIM).map(clean))
    .filter((parts) => parts[0] && parts[0].length > 3)
    .map((parts) => ({
      hook: parts[0],
      format: parts[1] || "Reel",
      signal: parts[2] || "Saves",
      effort: parts[3] || "Medium",
      why: parts[4] || "",
    }));
}

/** Clearly-labelled stand-ins so the page works with no provider key present. */
function simulatedIdeas(niche: string, platformName: string): ViralIdea[] {
  return [
    {
      hook: `"Nobody tells you this about ${niche}…"`,
      format: "Reel",
      signal: "Saves",
      effort: "Low",
      why: "Curiosity gaps and insider knowledge get saved to revisit.",
    },
    {
      hook: `A day-in-the-life inside ${niche}, no narration`,
      format: "Short",
      signal: "Watch-through",
      effort: "Medium",
      why: "Ambient, relatable footage holds attention to the end.",
    },
    {
      hook: `"Save this before your next ${niche} mistake"`,
      format: "Carousel",
      signal: "Saves",
      effort: "Low",
      why: "Utility promises earn the save, which widens reach.",
    },
    {
      hook: `Hot take: the ${platformName} advice everyone in ${niche} gets wrong`,
      format: "Text",
      signal: "Comments",
      effort: "Low",
      why: "A defensible contrarian view pulls people into the thread.",
    },
  ];
}

export async function findViralIdeas(
  input: ViralRequestInput,
  options: { signal?: AbortSignal } = {},
): Promise<ViralResult> {
  const platformName = getPlatform(input.platform).name;
  const model = resolveModel("text");

  if (!model) {
    return {
      ideas: simulatedIdeas(input.niche, platformName),
      simulated: true,
      model: "simulated",
    };
  }

  const job = buildJob(platformName, input.niche);
  const outcome = await runChain(fallbackChain("text", model), (candidate) => {
    const provider = textProviderFor(candidate);
    if (!provider) {
      return Promise.reject(
        new ProviderError(candidate.provider, null, "provider not registered"),
      );
    }
    return provider.generate(job, candidate, options.signal).then((variants) => {
      if (variants.length === 0) {
        throw new ProviderError(candidate.provider, null, "no ideas returned");
      }
      return variants;
    });
  });

  return {
    ideas: parseIdeas(outcome.value),
    simulated: false,
    model: outcome.model.label,
  };
}
