import { describe, expect, it } from "vitest";

import {
  FREE_LIMITS,
  PLANS,
  getPlan,
  isOverLimit,
  lifetimeBreakEvenMonths,
  limitsForTier,
  remaining,
  type PlanTier,
} from "@/lib/plans";

describe("plan catalogue", () => {
  it("exposes exactly the three paid tiers, in ladder order", () => {
    expect(PLANS.map((p) => p.tier)).toEqual(["creator", "studio", "agency"]);
  });

  it("never ships a plan for the free tier — free is the absence of a plan", () => {
    expect(PLANS.some((p) => p.tier === "free")).toBe(false);
  });

  it("highlights exactly one plan on the pricing page", () => {
    expect(PLANS.filter((p) => p.featured)).toHaveLength(1);
    expect(PLANS.find((p) => p.featured)?.tier).toBe("studio");
  });
});

describe("pricing", () => {
  it("charges 99 / 199 / 299 per month, in cents", () => {
    expect(PLANS.map((p) => p.priceCents.monthly)).toEqual([9900, 19900, 29900]);
  });

  it("charges 499 / 999 / 1999 once, in cents", () => {
    expect(PLANS.map((p) => p.priceCents.lifetime)).toEqual([
      49900, 99900, 199900,
    ]);
  });

  it("prices in whole dollars so the pricing table never renders cents", () => {
    for (const plan of PLANS) {
      expect(plan.priceCents.monthly % 100).toBe(0);
      expect(plan.priceCents.lifetime % 100).toBe(0);
    }
  });

  it("climbs monotonically as the ladder goes up", () => {
    for (let i = 1; i < PLANS.length; i += 1) {
      expect(PLANS[i].priceCents.monthly).toBeGreaterThan(
        PLANS[i - 1].priceCents.monthly,
      );
      expect(PLANS[i].priceCents.lifetime).toBeGreaterThan(
        PLANS[i - 1].priceCents.lifetime,
      );
    }
  });
});

describe("getPlan", () => {
  it("resolves every tier it advertises", () => {
    for (const plan of PLANS) {
      expect(getPlan(plan.tier)).toBe(plan);
    }
  });

  it("returns null for the free tier", () => {
    expect(getPlan("free")).toBeNull();
  });

  it("returns null rather than undefined for an unknown tier", () => {
    const unknown = "enterprise" as PlanTier;
    expect(getPlan(unknown)).toBeNull();
  });
});

describe("limitsForTier", () => {
  it("falls back to FREE_LIMITS for the free tier", () => {
    expect(limitsForTier("free")).toBe(FREE_LIMITS);
  });

  it("falls back to FREE_LIMITS for a tier that has no plan", () => {
    expect(limitsForTier("enterprise" as PlanTier)).toBe(FREE_LIMITS);
  });

  it("returns the plan's own limits for paid tiers", () => {
    expect(limitsForTier("creator").channels).toBe(8);
    expect(limitsForTier("studio").workspaces).toBe(5);
    expect(limitsForTier("agency").channels).toBeNull();
  });

  it("gives the free tier no automations, so the upsell is real", () => {
    expect(FREE_LIMITS.automations).toBe(0);
  });

  it("never lets a paid tier offer less headroom than free", () => {
    const metered = ["workspaces", "seats", "imageCredits", "aiWords", "automations", "analyticsMonths"] as const;
    for (const plan of PLANS) {
      for (const key of metered) {
        expect(plan.limits[key]).toBeGreaterThanOrEqual(FREE_LIMITS[key]);
      }
    }
  });
});

describe("lifetimeBreakEvenMonths", () => {
  it("rounds the lifetime price to whole months of the monthly price", () => {
    const byTier = Object.fromEntries(
      PLANS.map((p) => [p.tier, lifetimeBreakEvenMonths(p)]),
    );

    // 49900/9900 = 5.04, 99900/19900 = 5.02, 199900/29900 = 6.69
    expect(byTier).toEqual({ creator: 5, studio: 5, agency: 7 });
  });

  it("always returns a whole number of months", () => {
    for (const plan of PLANS) {
      expect(Number.isInteger(lifetimeBreakEvenMonths(plan))).toBe(true);
    }
  });

  it("keeps lifetime worth buying — under a year of monthly", () => {
    for (const plan of PLANS) {
      const months = lifetimeBreakEvenMonths(plan);
      expect(months).toBeGreaterThan(1);
      expect(months).toBeLessThan(12);
    }
  });
});

describe("isOverLimit", () => {
  it("never blocks an unmetered limit, however much is used", () => {
    expect(isOverLimit(0, null)).toBe(false);
    expect(isOverLimit(1_000_000, null)).toBe(false);
  });

  it("blocks once usage reaches the cap, not only past it", () => {
    expect(isOverLimit(7, 8)).toBe(false);
    expect(isOverLimit(8, 8)).toBe(true);
    expect(isOverLimit(9, 8)).toBe(true);
  });

  it("blocks immediately on a zero limit", () => {
    expect(isOverLimit(0, 0)).toBe(true);
  });

  it("treats null as unmetered, not as zero", () => {
    expect(isOverLimit(0, null)).not.toBe(isOverLimit(0, 0));
  });
});

describe("remaining", () => {
  it("returns null for an unmetered limit", () => {
    expect(remaining(42, null)).toBeNull();
  });

  it("reports the untouched headroom", () => {
    expect(remaining(0, 20)).toBe(20);
    expect(remaining(6, 20)).toBe(14);
  });

  it("clamps to zero instead of going negative when a cap is exceeded", () => {
    expect(remaining(25, 20)).toBe(0);
    expect(remaining(10_000, 20)).toBe(0);
  });

  it("agrees with isOverLimit at every boundary", () => {
    for (const used of [0, 19, 20, 21]) {
      expect(remaining(used, 20) === 0).toBe(isOverLimit(used, 20));
    }
  });
});
