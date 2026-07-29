"use client";

import { demoCategories, demoPosts } from "@/lib/demo";
import { getPlatform, type PlatformId } from "@/lib/platforms";
import {
  buildQueue,
  formatZonedTime,
  slotsPerDay,
  type Slot,
} from "@/lib/scheduling";
import { cn } from "@/lib/utils";

export interface CalendarEvent {
  id: string;
  at: Date;
  title: string;
  channels: PlatformId[];
  status: "published" | "scheduled" | "draft" | "recycling";
  category: string;
}

export const STATUS_DOT: Record<CalendarEvent["status"], string> = {
  published: "bg-ok",
  scheduled: "bg-signal",
  draft: "bg-warn",
  recycling: "bg-info",
};

const TITLE_POOL: readonly string[] = [
  ...demoPosts.map((post) => post.title),
  "Three sentences that stop a meltdown",
  "The snack drawer that bought us 20 minutes",
  "We tried the 'one toy out' rule for a month",
  "Reading the same book 40 times, ranked",
  "What we say when the tantrum is in public",
  "Nobody warned us about the 4pm hour",
  "The bedtime playlist that actually works",
  "Screen-time rules we stopped enforcing",
  "A week of dinners a 3-year-old will eat",
];

const CHANNEL_SETS: readonly PlatformId[][] = [
  ["instagram", "facebook", "threads"],
  ["tiktok", "youtube", "instagram"],
  ["pinterest", "facebook"],
  ["instagram"],
  ["facebook", "threads"],
  ["tiktok", "instagram"],
  ["youtube", "pinterest"],
];

/**
 * Deterministic 32-bit mix. Sample entries have to look scattered without
 * being random: the same slot must produce the same post on the server, on
 * the client, and after any navigation.
 */
function hash(seed: number): number {
  let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
}

function pick<T>(items: readonly T[], roll: number): T {
  return items[Math.min(items.length - 1, Math.floor(roll * items.length))];
}

/** Every entry the calendar shows between two instants, derived from the plan. */
export function buildEvents(
  slots: readonly Slot[],
  from: Date,
  to: Date,
  timeZone: string,
  now: Date,
): CalendarEvent[] {
  if (slots.length === 0) return [];

  const days = Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const capacity = Math.max(1, slotsPerDay(slots)) * days + slots.length;

  return buildQueue(slots, from, timeZone, capacity)
    .filter((at) => at.getTime() <= to.getTime())
    .map((at) => {
      // Seed off the instant, not the loop index, so an entry keeps its
      // identity when the visible range moves around it.
      const seed = Math.floor(at.getTime() / 60_000);
      const skip = hash(seed);
      if (skip < 0.16) return null;

      const past = at.getTime() < now.getTime();
      const state = hash(seed * 7 + 13);

      return {
        id: `evt-${at.getTime()}`,
        at,
        title: pick(TITLE_POOL, hash(seed * 3 + 11)),
        channels: pick(CHANNEL_SETS, hash(seed * 5 + 17)),
        category: pick(demoCategories, hash(seed * 11 + 3)).name,
        status: past
          ? ("published" as const)
          : state < 0.12
            ? ("draft" as const)
            : state < 0.24
              ? ("recycling" as const)
              : ("scheduled" as const),
      };
    })
    .filter((event): event is CalendarEvent => event !== null);
}

/**
 * Side-by-side placement for entries that fire close enough together to
 * overlap in the week grid.
 */
export function layoutColumns(
  events: readonly CalendarEvent[],
  windowMs = 45 * 60_000,
): { event: CalendarEvent; column: number; columns: number }[] {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const placed: { event: CalendarEvent; column: number; columns: number }[] = [];
  let cluster: CalendarEvent[] = [];

  const flush = () => {
    cluster.forEach((event, column) =>
      placed.push({ event, column, columns: cluster.length }),
    );
    cluster = [];
  };

  for (const event of sorted) {
    const previous = cluster[cluster.length - 1];
    if (previous && event.at.getTime() - previous.at.getTime() >= windowMs) {
      flush();
    }
    cluster.push(event);
  }
  flush();

  return placed;
}

export function EventChip({
  event,
  timeZone,
  onSelect,
  selected,
  showTime = true,
  className,
  style,
}: {
  event: CalendarEvent;
  timeZone: string;
  onSelect: (event: CalendarEvent, anchor: DOMRect) => void;
  selected: boolean;
  showTime?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const accent = getPlatform(event.channels[0]).hex;

  return (
    <button
      type="button"
      onClick={(mouseEvent) =>
        onSelect(event, mouseEvent.currentTarget.getBoundingClientRect())
      }
      style={{ ...style, borderLeftColor: accent }}
      className={cn(
        "flex w-full items-center gap-1.5 overflow-hidden rounded-md border border-line border-l-2 bg-surface px-1.5 py-1 text-left transition-colors hover:bg-surface-2",
        selected && "ring-1 ring-signal",
        className,
      )}
      title={`${formatZonedTime(event.at, timeZone)} · ${event.title}`}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[event.status])}
      />
      {showTime ? (
        <span className="shrink-0 font-mono text-[10.5px] text-subtle tabular">
          {formatZonedTime(event.at, timeZone)}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-[11.5px]">{event.title}</span>
    </button>
  );
}
