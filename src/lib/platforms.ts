/**
 * Platform registry.
 *
 * Every publishing rule the composer enforces lives here, so validation,
 * previews and the scheduler all read from one source instead of each
 * re-deriving "how long can an X post be".
 */

export type PlatformId =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin"
  | "pinterest"
  | "threads";

export type MediaKind = "image" | "video";

export type PostFormat =
  | "text"
  | "image"
  | "carousel"
  | "video"
  | "reel"
  | "short"
  | "story";

export interface PlatformSpec {
  id: PlatformId;
  name: string;
  /** Tailwind colour token suffix — `text-ch-facebook`, `bg-ch-facebook`. */
  colorToken: string;
  /** Hex mirror of the token, for canvas/SVG rendering where CSS vars can't reach. */
  hex: string;
  /** Maximum caption length in characters. */
  captionLimit: number;
  /** Formats the platform can receive. */
  formats: readonly PostFormat[];
  /** Media items allowed on a single post. */
  maxMedia: number;
  /** Video duration bounds in seconds, when the platform takes video. */
  video?: { minSeconds: number; maxSeconds: number };
  /** Hashtag ceiling, when the platform enforces one. */
  maxHashtags?: number;
  /** True when the platform can host comment-keyword automations. */
  supportsCommentAutomation: boolean;
  /** True when publishing needs an explicit media item (no text-only posts). */
  requiresMedia: boolean;
}

export const PLATFORMS: Record<PlatformId, PlatformSpec> = {
  facebook: {
    id: "facebook",
    name: "Facebook",
    colorToken: "ch-facebook",
    hex: "#1877F2",
    captionLimit: 63_206,
    formats: ["text", "image", "carousel", "video", "reel", "story"],
    maxMedia: 10,
    video: { minSeconds: 1, maxSeconds: 7_200 },
    supportsCommentAutomation: true,
    requiresMedia: false,
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    colorToken: "ch-instagram",
    hex: "#E1306C",
    captionLimit: 2_200,
    formats: ["image", "carousel", "reel", "story"],
    maxMedia: 20,
    video: { minSeconds: 3, maxSeconds: 900 },
    maxHashtags: 30,
    supportsCommentAutomation: true,
    requiresMedia: true,
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    colorToken: "ch-tiktok",
    hex: "#00D1C1",
    captionLimit: 2_200,
    formats: ["video", "carousel"],
    maxMedia: 35,
    video: { minSeconds: 3, maxSeconds: 600 },
    supportsCommentAutomation: false,
    requiresMedia: true,
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    colorToken: "ch-youtube",
    hex: "#FF0033",
    captionLimit: 5_000,
    formats: ["video", "short"],
    maxMedia: 1,
    video: { minSeconds: 1, maxSeconds: 43_200 },
    maxHashtags: 15,
    supportsCommentAutomation: false,
    requiresMedia: true,
  },
  x: {
    id: "x",
    name: "X",
    colorToken: "ch-x",
    hex: "#6D7580",
    captionLimit: 280,
    formats: ["text", "image", "carousel", "video"],
    maxMedia: 4,
    video: { minSeconds: 1, maxSeconds: 140 },
    supportsCommentAutomation: false,
    requiresMedia: false,
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    colorToken: "ch-linkedin",
    hex: "#0A66C2",
    captionLimit: 3_000,
    formats: ["text", "image", "carousel", "video"],
    maxMedia: 20,
    video: { minSeconds: 3, maxSeconds: 900 },
    supportsCommentAutomation: false,
    requiresMedia: false,
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    colorToken: "ch-pinterest",
    hex: "#E60023",
    captionLimit: 500,
    formats: ["image", "video"],
    maxMedia: 1,
    video: { minSeconds: 4, maxSeconds: 900 },
    supportsCommentAutomation: false,
    requiresMedia: true,
  },
  threads: {
    id: "threads",
    name: "Threads",
    colorToken: "ch-threads",
    hex: "#9B6DFF",
    captionLimit: 500,
    formats: ["text", "image", "carousel", "video"],
    maxMedia: 20,
    video: { minSeconds: 1, maxSeconds: 300 },
    supportsCommentAutomation: false,
    requiresMedia: false,
  },
};

export const PLATFORM_IDS = Object.keys(PLATFORMS) as PlatformId[];

export const PLATFORM_LIST: readonly PlatformSpec[] = PLATFORM_IDS.map(
  (id) => PLATFORMS[id],
);

export function getPlatform(id: PlatformId): PlatformSpec {
  return PLATFORMS[id];
}

export function isPlatformId(value: string): value is PlatformId {
  // `in` would walk the prototype chain and accept "toString", "constructor"
  // and friends, which then index PLATFORMS to a junk object.
  return Object.hasOwn(PLATFORMS, value);
}

/** Canvas presets the AI image studio offers, keyed by intent not by pixels. */
export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Platforms this size is idiomatic for. */
  bestFor: readonly PlatformId[];
}

export const SIZE_PRESETS: readonly SizePreset[] = [
  {
    id: "vertical-9x16",
    label: "Vertical story / reel",
    width: 1080,
    height: 1920,
    bestFor: ["instagram", "tiktok", "youtube", "facebook"],
  },
  {
    id: "portrait-4x5",
    label: "Portrait feed",
    width: 1080,
    height: 1350,
    bestFor: ["instagram", "facebook"],
  },
  {
    id: "square-1x1",
    label: "Square",
    width: 1080,
    height: 1080,
    bestFor: ["instagram", "facebook", "linkedin", "threads"],
  },
  {
    id: "landscape-16x9",
    label: "Landscape / thumbnail",
    width: 1920,
    height: 1080,
    bestFor: ["youtube", "x", "linkedin", "facebook"],
  },
  {
    id: "pin-2x3",
    label: "Pin",
    width: 1000,
    height: 1500,
    bestFor: ["pinterest"],
  },
  {
    id: "wide-3x1",
    label: "Cover banner",
    width: 1500,
    height: 500,
    bestFor: ["x", "linkedin"],
  },
];

/** Bounds for the custom-size field, matched to what the image models accept. */
export const CUSTOM_SIZE_BOUNDS = {
  min: 256,
  max: 4096,
  /** Models work in multiples of 8; the UI snaps to this. */
  step: 8,
} as const;

export function clampDimension(value: number): number {
  const { min, max, step } = CUSTOM_SIZE_BOUNDS;
  const bounded = Math.min(max, Math.max(min, Math.round(value)));
  return Math.round(bounded / step) * step;
}
