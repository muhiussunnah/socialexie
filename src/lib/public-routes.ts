import { site } from "@/lib/site";

/**
 * Inventory of publicly indexable routes.
 *
 * One source for the sitemap, llms.txt and the feed, so those three can never
 * disagree about what exists. Only add a route here when it is genuinely
 * indexable — the sitemap's accuracy is a trust signal, and padding it with
 * redirects or noindex pages actively hurts.
 */

export interface PublicRoute {
  path: string;
  /** Short label used in llms.txt and feed entries. */
  title: string;
  /** One line that disambiguates this page from the others. */
  summary: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  /**
   * Bump when the page's content materially changes. Deliberately manual: a
   * build timestamp would claim every page changed on every deploy, which
   * teaches crawlers to distrust the field.
   */
  updated: string;
}

const UPDATED = "2026-07-30";

export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  {
    path: "/",
    title: "Socialexie — the control room for social growth",
    summary:
      "What Socialexie is: one desk to plan, generate and publish across eight social networks.",
    priority: 1,
    changeFrequency: "weekly",
    updated: UPDATED,
  },
  {
    path: "/pricing",
    title: "Pricing — monthly plans and one-time licences",
    summary:
      "Monthly plans from $99 and one-time lifetime licences from $499, with the limits for each tier.",
    priority: 0.9,
    changeFrequency: "monthly",
    updated: UPDATED,
  },
  {
    path: "/about",
    title: "About Socialexie",
    summary:
      "Why the product exists, what it deliberately leaves out, and the stance it takes on reach and platform rules.",
    priority: 0.7,
    changeFrequency: "monthly",
    updated: UPDATED,
  },
  {
    path: "/tools",
    title: "Free creator tools — repurpose your own videos",
    summary:
      "Free tools to turn one video you made into a week of native posts across every network.",
    priority: 0.8,
    changeFrequency: "monthly",
    updated: "2026-08-05",
  },
  {
    path: "/tools/tiktok-video-repurposer",
    title: "TikTok video repurposer",
    summary:
      "Turn one TikTok you made into native posts for every other network, with a free caption generator.",
    priority: 0.8,
    changeFrequency: "monthly",
    updated: "2026-08-05",
  },
  {
    path: "/tools/instagram-video-repurposer",
    title: "Instagram Reels repurposer",
    summary:
      "Reshape your own Instagram Reels for every network and reschedule them, with a free caption generator.",
    priority: 0.8,
    changeFrequency: "monthly",
    updated: "2026-08-05",
  },
  {
    path: "/tools/youtube-video-repurposer",
    title: "YouTube video repurposer",
    summary:
      "Cut your own YouTube videos into Shorts and clips for every network, with a free title and caption generator.",
    priority: 0.8,
    changeFrequency: "monthly",
    updated: "2026-08-05",
  },
  {
    path: "/tools/facebook-video-repurposer",
    title: "Facebook video repurposer",
    summary:
      "Repurpose your own Facebook videos and Reels across every network, with a free caption generator.",
    priority: 0.8,
    changeFrequency: "monthly",
    updated: "2026-08-05",
  },
  {
    path: "/contact",
    title: "Contact",
    summary:
      "How to reach the team about support, billing, security reports or partnerships.",
    priority: 0.6,
    changeFrequency: "yearly",
    updated: UPDATED,
  },
  {
    path: "/legal/security",
    title: "Security",
    summary:
      "How workspace data is isolated, how channel tokens are stored, and the automation guardrails we enforce.",
    priority: 0.5,
    changeFrequency: "yearly",
    updated: UPDATED,
  },
  {
    path: "/legal/privacy",
    title: "Privacy",
    summary: "What Socialexie collects, why, and what it never does with it.",
    priority: 0.4,
    changeFrequency: "yearly",
    updated: UPDATED,
  },
  {
    path: "/legal/terms",
    title: "Terms of service",
    summary: "The agreement between you and Socialexie, in plain language.",
    priority: 0.4,
    changeFrequency: "yearly",
    updated: UPDATED,
  },
];

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}
