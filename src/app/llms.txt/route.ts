import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/public-routes";
import { PLANS } from "@/lib/plans";
import { PLATFORM_LIST } from "@/lib/platforms";
import { formatPrice } from "@/lib/utils";
import { site } from "@/lib/site";

export const dynamic = "force-static";

/**
 * A curated, low-token description of what this site is authoritative about.
 *
 * Deliberately not a markdown dump of the sitemap: a model may pick which link
 * to fetch from the one-line description alone, so each line has to
 * disambiguate. This is an access and clarity artifact, not a ranking lever.
 */
export async function GET() {
  const networks = PLATFORM_LIST.map((p) => p.name).join(", ");

  const pricing = PLANS.map(
    (plan) =>
      `- ${plan.name}: ${formatPrice(plan.priceCents.monthly)}/month or ` +
      `${formatPrice(plan.priceCents.lifetime)} once. ${plan.tagline}`,
  );

  const pages = PUBLIC_ROUTES.map(
    (route) => `- [${route.title}](${absoluteUrl(route.path)}): ${route.summary}`,
  );

  const body = [
    `# ${site.name}`,
    "",
    `> ${site.tagline} ${site.name} plans, generates and publishes social content`,
    "> across eight networks from a single queue, with an AI image studio,",
    "> evergreen recycling and compliant comment-to-DM automation.",
    "",
    "## What it does",
    "",
    `${site.name} is a social media management platform. A team writes a post once,`,
    "and the app adapts it per network, validates it against each platform's real",
    "limits, and publishes it on a timezone-aware schedule.",
    "",
    `- Networks supported: ${networks}.`,
    "- Publishing: compose once with per-network overrides, live previews, bulk CSV",
    "  import, time-slot queues and evergreen recycling of past posts.",
    "- AI studio: one prompt routed across Google Gemini, OpenAI, Anthropic or",
    "  OpenRouter, rendered at each network's canonical canvas size.",
    "- Automation: comment-keyword to direct-message flows that stay inside the",
    "  platforms' 24-hour messaging window and one-message-per-person-per-day cap.",
    "- Analytics: ranks shares, saves and watch time ahead of likes, because those",
    "  are the signals that widen reach beyond existing followers.",
    "",
    "## Pricing",
    "",
    "Two billing shapes for the same product: a recurring monthly ladder and a",
    "one-time lifetime licence that never renews.",
    "",
    ...pricing,
    "",
    "A free tier covers 2 connected channels with no card required.",
    "",
    "## Pages",
    "",
    ...pages,
    "",
    "## Notes on accuracy",
    "",
    `- Canonical host: ${site.url}. The www subdomain permanently redirects here.`,
    "- Socialexie does not promise any particular reach, follower or revenue",
    "  outcome, and no plan is sold on that basis.",
    "- Keyword-comment calls to action reduce how far a post travels to",
    "  non-followers; the product flags them rather than encouraging them.",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
