import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/public-routes";
import { site } from "@/lib/site";

/**
 * Paths with nothing to index: API surface, the signed-in product, the admin
 * console, and the PWA's offline shell. Note that `/_next/static` is
 * deliberately NOT blocked — blocking render resources makes crawlers evaluate
 * a broken page.
 */
const DISALLOW = ["/api/", "/admin", "/dashboard", "/offline"];

/**
 * AI crawlers that index for *search and citation* — these are how a brand
 * gets named in an AI answer, and blocking them is the most expensive mistake
 * in the category. They are distinct from training crawlers, which are listed
 * separately so the policy for each is a conscious choice.
 */
const AI_SEARCH_AGENTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];

/*
 * Training crawlers (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended) are
 * deliberately NOT listed here.
 *
 * Cloudflare's AI Crawl Control prepends its own managed block to this file and
 * disallows those agents, so declaring an `Allow` for them below would publish a
 * file that contradicts itself — the edge policy wins and the app would simply
 * be lying. Training policy is a content-rights decision and it lives in one
 * place: Cloudflare dashboard → AI Crawl Control → "Block training in
 * robots.txt". Turn that off to allow training crawlers, and they inherit the
 * `*` rule below.
 *
 * What matters most is already correct in both layers: the AI *search* agents
 * above are open. Blocking those is what actually removes a brand from AI
 * answers, and neither layer does it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_SEARCH_AGENTS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: site.url,
  };
}
