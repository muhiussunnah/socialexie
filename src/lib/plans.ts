/**
 * Plan catalogue.
 *
 * Two billing shapes sit side by side and the pricing page toggles between
 * them: a recurring monthly ladder and a one-time lifetime ladder. Both
 * ladders share tier identities (creator / studio / agency) so entitlements
 * can be resolved from the tier alone, regardless of how it was paid for.
 */

export type BillingMode = "monthly" | "lifetime";
export type PlanTier = "free" | "creator" | "studio" | "agency";

/** Numeric caps. `null` means unmetered for that tier. */
export interface PlanLimits {
  /** Connected social accounts across all workspaces. */
  channels: number | null;
  /** Brands / workspaces the account may create. */
  workspaces: number;
  /** Team seats including the owner. */
  seats: number;
  /** Posts that may sit scheduled in the queue at once. */
  queuedPosts: number | null;
  /** AI image generations granted per month. */
  imageCredits: number;
  /** AI words granted per month. */
  aiWords: number;
  /** Active comment-to-DM automations. */
  automations: number;
  /** Months of analytics history retained. */
  analyticsMonths: number;
}

export interface Plan {
  tier: PlanTier;
  name: string;
  tagline: string;
  /** Price in cents. Monthly plans bill every month; lifetime bills once. */
  priceCents: Record<BillingMode, number>;
  limits: PlanLimits;
  /** Marketing bullets, most differentiating first. */
  highlights: string[];
  /** Rendered with extra emphasis on the pricing page. */
  featured?: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    tier: "creator",
    name: "Creator",
    tagline: "For one brand that posts every day.",
    priceCents: { monthly: 9_900, lifetime: 49_900 },
    limits: {
      channels: 8,
      workspaces: 1,
      seats: 2,
      queuedPosts: 500,
      imageCredits: 500,
      aiWords: 150_000,
      automations: 3,
      analyticsMonths: 6,
    },
    highlights: [
      "8 connected channels",
      "500 posts queued at once",
      "500 AI images / month",
      "3 comment-to-DM automations",
      "Evergreen recycling",
    ],
  },
  {
    tier: "studio",
    name: "Studio",
    tagline: "For creators running several brands at once.",
    priceCents: { monthly: 19_900, lifetime: 99_900 },
    limits: {
      channels: 30,
      workspaces: 5,
      seats: 6,
      queuedPosts: 5_000,
      imageCredits: 2_500,
      aiWords: 750_000,
      automations: 25,
      analyticsMonths: 24,
    },
    highlights: [
      "30 channels across 5 brands",
      "5,000 posts queued at once",
      "2,500 AI images / month",
      "25 automations + bulk CSV import",
      "Approval workflow & team seats",
    ],
    featured: true,
  },
  {
    tier: "agency",
    name: "Agency",
    tagline: "For teams shipping content for clients.",
    priceCents: { monthly: 29_900, lifetime: 199_900 },
    limits: {
      channels: null,
      workspaces: 50,
      seats: 25,
      queuedPosts: null,
      imageCredits: 10_000,
      aiWords: 3_000_000,
      automations: 250,
      analyticsMonths: 36,
    },
    highlights: [
      "Unlimited channels & queue",
      "50 client brands, 25 seats",
      "10,000 AI images / month",
      "White-label reports & API access",
      "Priority publishing lane",
    ],
  },
] as const;

/** What an account gets before it has ever paid. */
export const FREE_LIMITS: PlanLimits = {
  channels: 2,
  workspaces: 1,
  seats: 1,
  queuedPosts: 20,
  imageCredits: 15,
  aiWords: 5_000,
  automations: 0,
  analyticsMonths: 1,
};

export function getPlan(tier: PlanTier): Plan | null {
  return PLANS.find((p) => p.tier === tier) ?? null;
}

export function limitsForTier(tier: PlanTier): PlanLimits {
  return getPlan(tier)?.limits ?? FREE_LIMITS;
}

/**
 * How many months of the monthly plan the lifetime price is worth. Used on the
 * pricing page to justify the one-time ladder honestly rather than inventing a
 * fake "% off".
 */
export function lifetimeBreakEvenMonths(plan: Plan): number {
  return Math.round(plan.priceCents.lifetime / plan.priceCents.monthly);
}

/** True when `used` has reached a capped limit. `null` limits never block. */
export function isOverLimit(used: number, limit: number | null): boolean {
  if (limit === null) return false;
  return used >= limit;
}

/** Remaining headroom, or `null` when the limit is unmetered. */
export function remaining(used: number, limit: number | null): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - used);
}
