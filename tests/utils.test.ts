import { describe, expect, it } from "vitest";

import { cn, compactNumber, formatPrice, initials } from "@/lib/utils";

describe("compactNumber", () => {
  it("leaves anything under a thousand alone", () => {
    expect(compactNumber(0)).toBe("0");
    expect(compactNumber(7)).toBe("7");
    expect(compactNumber(999)).toBe("999");
  });

  it("switches to K exactly at a thousand", () => {
    expect(compactNumber(999)).toBe("999");
    expect(compactNumber(1_000)).toBe("1K");
    expect(compactNumber(1_001)).toBe("1K");
  });

  it("drops trailing zeros rather than padding decimals", () => {
    expect(compactNumber(1_000)).toBe("1K");
    expect(compactNumber(1_500)).toBe("1.5K");
    expect(compactNumber(1_230)).toBe("1.23K");
  });

  it("loosens precision once the mantissa reaches double digits", () => {
    // Under 10 keeps two decimals, 10 and above keeps one — tiles stay narrow.
    expect(compactNumber(9_990)).toBe("9.99K");
    expect(compactNumber(12_500)).toBe("12.5K");
    expect(compactNumber(12_540)).toBe("12.5K");
  });

  it("scales through M and B", () => {
    expect(compactNumber(1_250_000)).toBe("1.25M");
    expect(compactNumber(1_000_000)).toBe("1M");
    expect(compactNumber(1e9)).toBe("1B");
    expect(compactNumber(2_400_000_000)).toBe("2.4B");
  });

  it("keeps the sign on negatives", () => {
    expect(compactNumber(-1)).toBe("-1");
    expect(compactNumber(-999)).toBe("-999");
    expect(compactNumber(-1_500)).toBe("-1.5K");
    expect(compactNumber(-1_250_000)).toBe("-1.25M");
  });

  it("picks the suffix from the magnitude, not the sign", () => {
    expect(compactNumber(-2_400)).toBe(`-${compactNumber(2_400)}`);
    expect(compactNumber(-7_600_000)).toBe(`-${compactNumber(7_600_000)}`);
  });

  it("renders an em dash for non-finite input instead of NaN", () => {
    expect(compactNumber(Number.NaN)).toBe("—");
    expect(compactNumber(Number.POSITIVE_INFINITY)).toBe("—");
    expect(compactNumber(Number.NEGATIVE_INFINITY)).toBe("—");
  });

  it("keeps the lower suffix when rounding pushes it to the next decade", () => {
    // 999,999 is still below the M threshold, so it reads as 1000K.
    expect(compactNumber(999_999)).toBe("1000K");
  });
});

describe("formatPrice", () => {
  it("renders whole dollars with no cents", () => {
    expect(formatPrice(9_900)).toBe("$99");
    expect(formatPrice(29_900)).toBe("$299");
    expect(formatPrice(0)).toBe("$0");
  });

  it("separates thousands", () => {
    expect(formatPrice(199_900)).toBe("$1,999");
    expect(formatPrice(1_234_500)).toBe("$12,345");
  });

  it("shows cents only when the amount actually has them", () => {
    expect(formatPrice(1_999)).toBe("$19.99");
    expect(formatPrice(9_950)).toBe("$99.50");
  });

  it("matches every catalogue price to a clean dollar string", () => {
    expect(formatPrice(49_900)).toBe("$499");
    expect(formatPrice(99_900)).toBe("$999");
  });

  it("honours a currency override", () => {
    expect(formatPrice(9_900, "EUR")).toBe("€99");
  });
});

describe("initials", () => {
  it("falls back when there is no name to work with", () => {
    expect(initials(null)).toBe("S");
    expect(initials(undefined)).toBe("S");
    expect(initials("")).toBe("S");
  });

  it("falls back on whitespace-only names", () => {
    expect(initials("   ")).toBe("S");
    expect(initials("\t\n ")).toBe("S");
  });

  it("accepts a custom fallback", () => {
    expect(initials(null, "?")).toBe("?");
    expect(initials("  ", "AB")).toBe("AB");
  });

  it("takes the first two letters of a single word", () => {
    expect(initials("Ada")).toBe("AD");
    expect(initials("ada")).toBe("AD");
    expect(initials("a")).toBe("A");
  });

  it("takes the first and last word for multi-word names", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("Ada Byron King Lovelace")).toBe("AL");
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(initials("  ada   lovelace  ")).toBe("AL");
  });

  it("always returns at most two characters", () => {
    for (const name of ["Ada", "Ada Lovelace", "a", "Ada Byron King"]) {
      expect(initials(name).length).toBeLessThanOrEqual(2);
    }
  });
});

describe("cn", () => {
  it("lets the later Tailwind utility win a conflict", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("resolves shorthand against longhand in the right direction", () => {
    expect(cn("px-2", "p-4")).toBe("p-4");
    expect(cn("p-4", "px-2")).toBe("p-4 px-2");
  });

  it("keeps utilities that do not conflict", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });

  it("drops falsy values", () => {
    expect(cn("flex", false, null, undefined, "", "gap-2")).toBe("flex gap-2");
  });

  it("accepts arrays and conditional objects", () => {
    expect(cn(["flex", { "gap-2": true, hidden: false }])).toBe("flex gap-2");
  });

  it("returns an empty string when given nothing", () => {
    expect(cn()).toBe("");
    expect(cn(undefined, null, false)).toBe("");
  });

  it("lets a caller override a component's default classes", () => {
    const componentDefaults = "rounded-lg px-4 py-2 bg-red-500";
    expect(cn(componentDefaults, "bg-blue-500")).toBe(
      "rounded-lg px-4 py-2 bg-blue-500",
    );
  });
});
