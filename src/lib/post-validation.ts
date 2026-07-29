import {
  getPlatform,
  PLATFORM_IDS,
  type PlatformId,
  type PostFormat,
} from "@/lib/platforms";

/**
 * Pre-flight checks that run before anything leaves the queue.
 *
 * Errors are things the network's API will reject outright; warnings are
 * things it will accept and then quietly under-deliver. Both matter, so both
 * surface — but only errors block publishing.
 */

export interface DraftPost {
  body: string;
  format: PostFormat;
  mediaCount: number;
  videoSeconds?: number;
  hashtags: string[];
  targets: PlatformId[];
}

export type IssueLevel = "error" | "warning";

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
}

export const ENGAGEMENT_BAIT_CODE = "engagement-bait";

export const ENGAGEMENT_BAIT_GUIDANCE =
  "Keyword replies convert well with people who already follow you, but recommendation feeds show these posts to far fewer non-followers. Worth keeping for a genuine lead magnet, and worth writing a caption that still lands without the comment.";

const FORMAT_LABELS: Record<PostFormat, string> = {
  text: "text-only",
  image: "single image",
  carousel: "carousel",
  video: "video",
  reel: "reel",
  short: "short",
  story: "story",
};

const VIDEO_FORMATS: readonly PostFormat[] = ["video", "reel", "short"];

export function isVideoFormat(format: PostFormat): boolean {
  return VIDEO_FORMATS.includes(format);
}

let cachedSegmenter: Intl.Segmenter | null | undefined;

function graphemeSegmenter(): Intl.Segmenter | null {
  if (cachedSegmenter === undefined) {
    cachedSegmenter =
      typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
        : null;
  }
  return cachedSegmenter;
}

/**
 * Count what a person sees, not what UTF-16 stores. A family emoji is one
 * character to the writer and up to eleven code units to `String#length`, and
 * a counter that disagrees with the user is worse than no counter.
 */
export function countGraphemes(text: string): number {
  const segmenter = graphemeSegmenter();
  if (!segmenter) return Array.from(text).length;
  return Array.from(segmenter.segment(text)).length;
}

const HASHTAG_PATTERN = /(?:^|\s)(#[\p{L}\p{N}_]+)/gu;

export function extractHashtags(text: string): string[] {
  return Array.from(text.matchAll(HASHTAG_PATTERN), (match) => match[1]);
}

/** Lowest caption ceiling across the selected networks — what the counter tracks. */
export function strictestCaptionLimit(
  targets: readonly PlatformId[],
): number | null {
  if (targets.length === 0) return null;
  return targets.reduce(
    (limit, id) => Math.min(limit, getPlatform(id).captionLimit),
    Number.POSITIVE_INFINITY,
  );
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const rest = Math.round(seconds % 60);
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}h` : `${hours}h ${restMinutes}m`;
}

/**
 * Words that follow "comment" in ordinary calls to action — "comment below",
 * "comment your favourite" — and should not be mistaken for a keyword trigger.
 */
const GENERIC_COMMENT_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "anything",
  "below",
  "down",
  "for",
  "here",
  "how",
  "if",
  "in",
  "it",
  "more",
  "now",
  "of",
  "on",
  "or",
  "please",
  "something",
  "that",
  "the",
  "them",
  "this",
  "thoughts",
  "to",
  "us",
  "what",
  "when",
  "which",
  "why",
  "with",
  "you",
  "your",
  "yours",
]);

const BAIT_PATTERNS: readonly RegExp[] = [
  // comment "GUIDE" · type “LINK” · dm me 'PLAN'
  /\b(?:comment|type|drop|dm(?:\s+me)?|reply(?:\s+with)?)\s+(?:the\s+word\s+)?["“'‘]([^"“”'’\n]{1,24})["”'’]/i,
  // comment the word guide
  /\b(?:comment|type|drop|dm(?:\s+me)?|reply(?:\s+with)?)\s+the\s+word\s+([\p{L}\p{N}][\p{L}\p{N}'’-]{0,23})/iu,
  // comment GUIDE below · type LINK in the comments · drop PLAN and I'll send it
  /\b(?:comment|type|drop)\s+([\p{L}\p{N}][\p{L}\p{N}'’-]{0,23})\s+(?:below|down below|in the comments|and\s+i(?:['’]ll|\s+will))/iu,
  // comment YES — shouting the keyword is the giveaway
  /\b(?:[Cc]omment|[Tt]ype|[Dd]rop|(?:DM|[Dd]m)\s+me)\s+([A-Z][A-Z0-9]{1,19})\b/,
];

/**
 * Spot a "comment KEYWORD and I'll send it" call to action.
 *
 * These are legitimate — they are how comment-to-DM funnels work — but they
 * cost non-follower reach, so the composer says so once rather than letting
 * people discover it from a flat week.
 */
export function detectEngagementBait(body: string): Issue | null {
  for (const pattern of BAIT_PATTERNS) {
    const keyword = pattern.exec(body)?.[1]?.trim();
    if (!keyword) continue;
    if (GENERIC_COMMENT_WORDS.has(keyword.toLowerCase())) continue;
    return {
      level: "warning",
      code: ENGAGEMENT_BAIT_CODE,
      message: `“${keyword}” reads as a keyword reply. ${ENGAGEMENT_BAIT_GUIDANCE}`,
    };
  }
  return null;
}

function listFormats(formats: readonly PostFormat[]): string {
  const labels = formats.map((format) => FORMAT_LABELS[format]);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function validateForPlatform(
  draft: DraftPost,
  platform: PlatformId,
): Issue[] {
  const spec = getPlatform(platform);
  const issues: Issue[] = [];
  const length = countGraphemes(draft.body);
  const hasText = draft.body.trim().length > 0;

  if (!spec.formats.includes(draft.format)) {
    issues.push({
      level: "error",
      code: "format-unsupported",
      message: `${spec.name} does not take a ${FORMAT_LABELS[draft.format]} post. It accepts ${listFormats(spec.formats)}.`,
    });
  }

  if (length > spec.captionLimit) {
    issues.push({
      level: "error",
      code: "caption-too-long",
      message: `Caption is ${length.toLocaleString()} characters and ${spec.name} allows ${spec.captionLimit.toLocaleString()} — cut ${(length - spec.captionLimit).toLocaleString()}.`,
    });
  } else if (spec.captionLimit <= 3_000 && length > spec.captionLimit * 0.9) {
    issues.push({
      level: "warning",
      code: "caption-near-limit",
      message: `${(spec.captionLimit - length).toLocaleString()} characters left on ${spec.name}.`,
    });
  }

  if (spec.requiresMedia && draft.mediaCount < 1) {
    issues.push({
      level: "error",
      code: "media-required",
      message: `${spec.name} has no text-only post type — attach an image or a video.`,
    });
  }

  if (draft.mediaCount > spec.maxMedia) {
    issues.push({
      level: "error",
      code: "too-many-media",
      message: `${draft.mediaCount} attachments, and ${spec.name} takes ${spec.maxMedia}.`,
    });
  }

  if (!spec.requiresMedia && draft.mediaCount === 0 && !hasText) {
    issues.push({
      level: "error",
      code: "empty-post",
      message: `Nothing to send to ${spec.name} yet — write a caption or attach media.`,
    });
  }

  if (isVideoFormat(draft.format)) {
    if (!spec.video) {
      issues.push({
        level: "error",
        code: "video-unsupported",
        message: `${spec.name} does not publish video.`,
      });
    } else if (draft.videoSeconds !== undefined) {
      if (draft.videoSeconds < spec.video.minSeconds) {
        issues.push({
          level: "error",
          code: "video-too-short",
          message: `${formatDuration(draft.videoSeconds)} clip — ${spec.name} needs at least ${formatDuration(spec.video.minSeconds)}.`,
        });
      } else if (draft.videoSeconds > spec.video.maxSeconds) {
        issues.push({
          level: "error",
          code: "video-too-long",
          message: `${formatDuration(draft.videoSeconds)} clip — ${spec.name} caps this format at ${formatDuration(spec.video.maxSeconds)}.`,
        });
      }
    }
  }

  if (spec.maxHashtags !== undefined && draft.hashtags.length > spec.maxHashtags) {
    issues.push({
      level: "error",
      code: "too-many-hashtags",
      message: `${draft.hashtags.length} hashtags, and ${spec.name} allows ${spec.maxHashtags}.`,
    });
  }

  const bait = detectEngagementBait(draft.body);
  if (bait) issues.push(bait);

  return issues;
}

export function validateDraft(draft: DraftPost): Record<PlatformId, Issue[]> {
  const result = {} as Record<PlatformId, Issue[]>;
  for (const platform of draft.targets) {
    result[platform] = validateForPlatform(draft, platform);
  }
  return result;
}

export function countIssues(result: Record<PlatformId, Issue[]>): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const platform of PLATFORM_IDS) {
    for (const issue of result[platform] ?? []) {
      if (issue.level === "error") errors++;
      else warnings++;
    }
  }
  return { errors, warnings };
}

export function hasBlockingErrors(result: Record<PlatformId, Issue[]>): boolean {
  return countIssues(result).errors > 0;
}
