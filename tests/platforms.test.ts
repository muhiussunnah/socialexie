import { describe, expect, it } from "vitest";

import {
  CUSTOM_SIZE_BOUNDS,
  PLATFORMS,
  PLATFORM_IDS,
  PLATFORM_LIST,
  SIZE_PRESETS,
  clampDimension,
  getPlatform,
  isPlatformId,
  type PlatformId,
} from "@/lib/platforms";

describe("PLATFORMS registry", () => {
  it("keys every entry by its own id", () => {
    for (const [key, spec] of Object.entries(PLATFORMS)) {
      expect(spec.id).toBe(key);
    }
  });

  it("derives PLATFORM_IDS and PLATFORM_LIST from the same source", () => {
    expect(PLATFORM_IDS).toHaveLength(Object.keys(PLATFORMS).length);
    expect(PLATFORM_LIST.map((p) => p.id)).toEqual(PLATFORM_IDS);
  });

  it("names its colour token after the id, so `bg-ch-<id>` always resolves", () => {
    for (const spec of PLATFORM_LIST) {
      expect(spec.colorToken).toBe(`ch-${spec.id}`);
    }
  });

  it("carries a hex mirror for canvas rendering where CSS vars cannot reach", () => {
    for (const spec of PLATFORM_LIST) {
      expect(spec.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("gives every platform a usable caption budget and at least one format", () => {
    for (const spec of PLATFORM_LIST) {
      expect(spec.captionLimit).toBeGreaterThan(0);
      expect(spec.formats.length).toBeGreaterThan(0);
      expect(spec.maxMedia).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejects text-only posts wherever media is mandatory", () => {
    const mediaOnly = PLATFORM_LIST.filter((p) => p.requiresMedia);

    expect(mediaOnly.map((p) => p.id)).toEqual([
      "instagram",
      "tiktok",
      "youtube",
      "pinterest",
    ]);

    for (const spec of mediaOnly) {
      expect(spec.formats).not.toContain("text");
    }
  });

  it("allows text only where media is optional", () => {
    for (const spec of PLATFORM_LIST) {
      if (spec.formats.includes("text")) {
        expect(spec.requiresMedia).toBe(false);
      }
    }
  });

  it("declares video bounds wherever a video format is accepted", () => {
    const videoFormats = ["video", "reel", "short", "story"] as const;

    for (const spec of PLATFORM_LIST) {
      const takesVideo = spec.formats.some((f) =>
        (videoFormats as readonly string[]).includes(f),
      );
      if (!takesVideo) continue;

      expect(spec.video).toBeDefined();
      expect(spec.video!.minSeconds).toBeGreaterThan(0);
      expect(spec.video!.maxSeconds).toBeGreaterThan(spec.video!.minSeconds);
    }
  });

  it("lists no duplicate formats", () => {
    for (const spec of PLATFORM_LIST) {
      expect(new Set(spec.formats).size).toBe(spec.formats.length);
    }
  });

  it("caps hashtags only where the network actually enforces one", () => {
    expect(PLATFORMS.instagram.maxHashtags).toBe(30);
    expect(PLATFORMS.youtube.maxHashtags).toBe(15);
    expect(PLATFORMS.x.maxHashtags).toBeUndefined();
  });
});

describe("getPlatform", () => {
  it("returns the same object the registry holds", () => {
    for (const id of PLATFORM_IDS) {
      expect(getPlatform(id)).toBe(PLATFORMS[id]);
    }
  });
});

describe("isPlatformId", () => {
  it("accepts every registered id", () => {
    for (const id of PLATFORM_IDS) {
      expect(isPlatformId(id)).toBe(true);
    }
  });

  it("rejects networks we do not publish to", () => {
    expect(isPlatformId("snapchat")).toBe(false);
    expect(isPlatformId("myspace")).toBe(false);
    expect(isPlatformId("")).toBe(false);
  });

  it("is case sensitive — ids are stored lowercase", () => {
    expect(isPlatformId("Instagram")).toBe(false);
    expect(isPlatformId("X")).toBe(false);
  });

  it("rejects inherited Object properties", () => {
    // A prototype-chain lookup would accept these, and indexing PLATFORMS with
    // one yields a function or Object.prototype — a "spec" with no captionLimit.
    for (const key of [
      "toString",
      "constructor",
      "valueOf",
      "hasOwnProperty",
      "isPrototypeOf",
    ]) {
      expect(isPlatformId(key)).toBe(false);
    }
  });

  it("narrows the type so a checked string can index the registry", () => {
    const raw: string = "linkedin";
    if (!isPlatformId(raw)) throw new Error("expected a platform id");

    // Both lines compile only because `raw` narrowed to PlatformId.
    const narrowed: PlatformId = raw;
    expect(PLATFORMS[narrowed].name).toBe("LinkedIn");
  });
});

describe("clampDimension", () => {
  const { min, max, step } = CUSTOM_SIZE_BOUNDS;

  it("pulls values below the floor up to the minimum", () => {
    expect(clampDimension(0)).toBe(min);
    expect(clampDimension(-5_000)).toBe(min);
    expect(clampDimension(min - 1)).toBe(min);
  });

  it("pulls values above the ceiling down to the maximum", () => {
    expect(clampDimension(99_999)).toBe(max);
    expect(clampDimension(max + 1)).toBe(max);
  });

  it("leaves the bounds themselves untouched — both are already on the grid", () => {
    expect(clampDimension(min)).toBe(min);
    expect(clampDimension(max)).toBe(max);
  });

  it("snaps to the nearest multiple of the step", () => {
    expect(clampDimension(300)).toBe(304);
    expect(clampDimension(1_079)).toBe(1_080);
    expect(clampDimension(1_083)).toBe(1_080);
    expect(clampDimension(1_084)).toBe(1_088);
  });

  it("rounds non-integer input before snapping", () => {
    expect(clampDimension(1_079.6)).toBe(1_080);
    expect(clampDimension(300.4)).toBe(304);
    expect(clampDimension(255.9)).toBe(min);
  });

  it("never escapes the bounds when snapping rounds outward", () => {
    // 4093 snaps up to 4096, which must stay inside the ceiling.
    expect(clampDimension(max - 3)).toBe(max);
    // 257 snaps down to 256, which must stay on or above the floor.
    expect(clampDimension(min + 1)).toBe(min);
  });

  it("always lands on the grid and inside the bounds", () => {
    const samples = [
      -1, 0, 1, 100, 255, 256, 257, 511, 512, 999, 1_000, 1_023, 2_047, 3_000,
      4_090, 4_095, 4_096, 4_097, 10_000,
    ];

    for (const value of samples) {
      const result = clampDimension(value);
      expect(result % step).toBe(0);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
    }
  });

  it("is idempotent — clamping a clamped value changes nothing", () => {
    for (const value of [-10, 300.4, 1_083, 4_093, 50_000]) {
      const once = clampDimension(value);
      expect(clampDimension(once)).toBe(once);
    }
  });
});

describe("SIZE_PRESETS", () => {
  it("uses unique ids", () => {
    const ids = SIZE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only recommends platforms that exist", () => {
    for (const preset of SIZE_PRESETS) {
      expect(preset.bestFor.length).toBeGreaterThan(0);
      for (const id of preset.bestFor) {
        expect(isPlatformId(id)).toBe(true);
        expect(PLATFORM_IDS).toContain(id);
      }
    }
  });

  it("recommends each platform at most once per preset", () => {
    for (const preset of SIZE_PRESETS) {
      expect(new Set(preset.bestFor).size).toBe(preset.bestFor.length);
    }
  });

  it("has positive, whole-pixel dimensions", () => {
    for (const preset of SIZE_PRESETS) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(Number.isInteger(preset.width)).toBe(true);
      expect(Number.isInteger(preset.height)).toBe(true);
    }
  });

  it("stays within the bounds the image models accept", () => {
    const { min, max } = CUSTOM_SIZE_BOUNDS;

    for (const preset of SIZE_PRESETS) {
      for (const side of [preset.width, preset.height]) {
        expect(side).toBeGreaterThanOrEqual(min);
        expect(side).toBeLessThanOrEqual(max);
      }
    }
  });

  it("covers every platform with at least one idiomatic size", () => {
    const covered = new Set(SIZE_PRESETS.flatMap((p) => [...p.bestFor]));
    for (const id of PLATFORM_IDS) {
      expect(covered).toContain(id);
    }
  });

  it("carries a human label for the size picker", () => {
    for (const preset of SIZE_PRESETS) {
      expect(preset.label.trim().length).toBeGreaterThan(0);
    }
  });
});
