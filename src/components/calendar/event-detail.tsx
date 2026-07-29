"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { ChannelIcon } from "@/components/channel-icon";
import { STATUS_DOT, type CalendarEvent } from "@/components/calendar/events";
import { Badge } from "@/components/ui/badge";
import { getPlatform } from "@/lib/platforms";
import { formatZonedDate, formatZonedTime } from "@/lib/scheduling";
import { cn } from "@/lib/utils";

const PANEL_WIDTH = 276;

const STATUS_TONE = {
  published: "ok",
  scheduled: "neutral",
  recycling: "info",
  draft: "warn",
} as const;

/** Floating panel pinned to whatever chip was clicked. */
function Popover({
  anchor,
  onClose,
  children,
}: {
  anchor: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    // mousedown rather than click, so clicking straight onto another entry
    // closes this panel and opens that one in the same gesture.
    function onMouseDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) closeRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  const left = Math.min(
    Math.max(8, anchor.left),
    Math.max(8, window.innerWidth - PANEL_WIDTH - 8),
  );
  const top = Math.min(anchor.bottom + 6, window.innerHeight - 240);

  return (
    <div
      ref={panelRef}
      role="dialog"
      className="fixed z-50 animate-rise rounded-card border border-line-strong bg-surface p-3 shadow-e3"
      style={{ left, top: Math.max(8, top), width: PANEL_WIDTH }}
    >
      {children}
    </div>
  );
}

export function EventDetail({
  event,
  anchor,
  timeZone,
  onClose,
}: {
  event: CalendarEvent;
  anchor: DOMRect;
  timeZone: string;
  onClose: () => void;
}) {
  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11.5px] text-subtle tabular">
            {formatZonedDate(event.at, timeZone)} ·{" "}
            {formatZonedTime(event.at, timeZone)}
          </p>
          <p className="mt-1 text-[13px] leading-snug font-medium">
            {event.title}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-0.5 rounded p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={STATUS_TONE[event.status]} className="capitalize">
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[event.status])} />
          {event.status}
        </Badge>
        <Badge>{event.category}</Badge>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-2.5">
        {event.channels.map((platform) => (
          <li key={platform} className="flex items-center gap-2 text-[12px]">
            <ChannelIcon platform={platform} size="sm" />
            {getPlatform(platform).name}
          </li>
        ))}
      </ul>

      <Link
        href="/dashboard/composer"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 py-1.5 text-[12.5px] font-medium transition-colors hover:border-line-strong hover:bg-surface-3"
      >
        Open in composer
        <ArrowUpRight className="size-3.5" />
      </Link>
    </Popover>
  );
}

export function DayDetail({
  day,
  events,
  anchor,
  timeZone,
  onClose,
  onSelect,
}: {
  day: Date;
  events: readonly CalendarEvent[];
  anchor: DOMRect;
  timeZone: string;
  onClose: () => void;
  onSelect: (event: CalendarEvent, anchor: DOMRect) => void;
}) {
  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-semibold">
          {formatZonedDate(day, timeZone)}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
        {events.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={(mouseEvent) =>
                onSelect(event, mouseEvent.currentTarget.getBoundingClientRect())
              }
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  STATUS_DOT[event.status],
                )}
              />
              <span className="shrink-0 font-mono text-[10.5px] text-subtle tabular">
                {formatZonedTime(event.at, timeZone)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11.5px]">
                {event.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
