import "server-only";

import type { PlatformId } from "@/lib/platforms";
import { linkedinAdapter } from "@/lib/publish/adapters/linkedin";
import { facebookAdapter, instagramAdapter } from "@/lib/publish/adapters/meta";
import { tiktokAdapter } from "@/lib/publish/adapters/tiktok";
import { xAdapter } from "@/lib/publish/adapters/x";
import { youtubeAdapter } from "@/lib/publish/adapters/youtube";
import type { PlatformAdapter } from "@/lib/publish/types";

/**
 * Platform adapter registry.
 *
 * The OAuth routes and the dispatcher only ever reach a network through this
 * map, so wiring up a new platform is a single entry here and nothing else has
 * to learn about it. Networks with no adapter yet (pinterest, threads) resolve
 * to `null`, which is the signal the composer and Channels UI use to disable a
 * network that can't publish yet.
 */
export const ADAPTERS: Partial<Record<PlatformId, PlatformAdapter>> = {
  facebook: facebookAdapter,
  instagram: instagramAdapter,
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter,
  x: xAdapter,
  linkedin: linkedinAdapter,
};

/** The adapter for a platform, or `null` when none is registered. */
export function adapterFor(platform: PlatformId): PlatformAdapter | null {
  return ADAPTERS[platform] ?? null;
}

/** True when a platform can actually be published to today. */
export function isPublishable(platform: PlatformId): boolean {
  return adapterFor(platform) !== null;
}
