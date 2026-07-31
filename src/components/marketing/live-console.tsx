"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Image as ImageIcon, Repeat2, Zap } from "lucide-react";
import { ChannelIcon, ChannelStack } from "@/components/channel-icon";
import { Counter } from "@/components/motion/counter";
import type { PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

type RowState = "queued" | "publishing" | "published" | "recycling" | "generating";

interface Row {
  time: string;
  title: string;
  channels: PlatformId[];
  /** The state it sits in when it is not the row currently going out. */
  base: RowState;
}

const ROWS: Row[] = [
  {
    time: "09:00",
    title: "7 things nobody tells you about a 3-year-old",
    channels: ["instagram", "facebook", "threads"],
    base: "published",
  },
  {
    time: "12:30",
    title: "Phone-free dinner challenge — day 4",
    channels: ["tiktok", "youtube", "instagram"],
    base: "queued",
  },
  {
    time: "15:15",
    title: "Save this: 5 things to say instead of 'good job'",
    channels: ["pinterest", "linkedin", "x"],
    base: "recycling",
  },
  {
    time: "19:00",
    title: "Sunset park carousel · 4 frames",
    channels: ["instagram", "facebook"],
    base: "generating",
  },
];

const STATE_STYLE: Record<RowState, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-surface-3 text-muted" },
  publishing: { label: "Publishing", className: "bg-signal-soft text-signal" },
  published: { label: "Published", className: "bg-ok-soft text-ok" },
  recycling: { label: "Recycling", className: "bg-info-soft text-info" },
  generating: { label: "Generating", className: "bg-signal-soft text-signal" },
};

const CHANNELS: PlatformId[] = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "x",
];

/**
 * The hero's product surface, running rather than posed.
 *
 * A single one-second interval drives the countdown and advances which row is
 * "going out"; everything else — the pulses, the sweep, the dots — is CSS. One
 * timer for the whole panel keeps this off the profiler.
 */
export function LiveConsole() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Counts down from 12 minutes, then loops — the queue never stops.
  const remaining = 761 - (tick % 762);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  // Every 4 seconds the "publishing" highlight steps to the next row.
  const activeRow = Math.floor(tick / 4) % ROWS.length;

  return (
    <div className="edge-glow relative rounded-panel border border-line bg-surface/90 shadow-e3 backdrop-blur-xl">
      {/* Status sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-panel">
        <div
          className="animate-scanline absolute inset-x-0 h-24 opacity-60"
          style={{
            background:
              "linear-gradient(180deg, transparent, color-mix(in srgb, var(--signal) 12%, transparent), transparent)",
          }}
        />
      </div>

      {/* Desk header */}
      <div className="relative flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-signal text-[11px] font-bold text-signal-fg">
            A
          </span>
          <span className="text-[13px] font-medium">Approved By Families</span>
        </div>

        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-live-soft px-2.5 py-0.5 text-[11px] font-medium text-live">
          <span className="relative flex size-2">
            <span className="animate-ring absolute inset-0 rounded-full bg-live" />
            <span className="relative size-2 rounded-full bg-live" />
          </span>
          Queue healthy
        </span>

        <span className="ml-auto hidden font-mono text-[11px] text-subtle tabular sm:block">
          next in 00:{mm}:{ss}
          <span className="animate-blink ml-0.5">_</span>
        </span>
      </div>

      <div className="relative grid gap-0 md:grid-cols-[168px_1fr]">
        {/* Channel rail */}
        <div className="border-line p-3 md:border-r">
          <p className="px-1 pb-2 text-[10px] font-semibold tracking-[0.14em] text-subtle uppercase">
            Channels
          </p>
          <div className="flex gap-1.5 md:flex-col">
            {CHANNELS.map((p, i) => (
              <div
                key={p}
                className="flex flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-2 md:flex-none"
              >
                <ChannelIcon platform={p} size="sm" />
                <span className="hidden text-[12px] text-muted md:block">
                  {p === "x" ? "X" : p[0].toUpperCase() + p.slice(1)}
                </span>
                <span
                  className="ml-auto hidden size-1.5 rounded-full bg-ok md:block"
                  style={{
                    animation: `pulse-live 2.4s ease-in-out ${i * 0.35}s infinite`,
                  }}
                />
              </div>
            ))}
            <div className="hidden items-center gap-2 rounded-lg px-1.5 py-1.5 md:flex">
              <span className="grid size-6 place-items-center rounded-[7px] border border-dashed border-line-strong text-[11px] text-subtle">
                +
              </span>
              <span className="text-[12px] text-subtle">3 more</span>
            </div>
          </div>
        </div>

        {/* Queue */}
        <div className="p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-subtle uppercase">
              Today&apos;s queue
            </p>
            <span className="font-mono text-[10px] text-subtle tabular">
              4 / 12 slots
            </span>
          </div>

          <ul className="flex flex-col gap-1">
            {ROWS.map((row, index) => {
              const isActive = index === activeRow;
              const state: RowState = isActive ? "publishing" : row.base;
              const style = STATE_STYLE[state];

              return (
                <li
                  key={row.time}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-2 py-2 transition-colors duration-500",
                    isActive
                      ? "border-signal-line bg-signal-soft/50"
                      : "border-transparent hover:border-line hover:bg-surface-2",
                  )}
                >
                  <span className="font-mono text-[11px] text-subtle tabular">
                    {row.time}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {row.title}
                  </span>
                  <ChannelStack
                    platforms={row.channels}
                    className="hidden sm:inline-flex"
                  />
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors duration-500",
                      style.className,
                    )}
                  >
                    {style.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Instrument strip */}
      <div className="relative grid grid-cols-2 gap-px border-t border-line bg-line md:grid-cols-4">
        {[
          { icon: CalendarClock, label: "Scheduled", value: 1284, compact: false },
          { icon: Repeat2, label: "Recycling", value: 37, compact: false, suffix: " rules" },
          { icon: ImageIcon, label: "AI images", value: 512, compact: false },
          { icon: Zap, label: "Automations", value: 9, compact: false, suffix: " live" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-2.5 bg-surface px-4 py-3"
          >
            <stat.icon className="size-4 text-subtle" />
            <div className="min-w-0">
              <p className="truncate text-[10px] tracking-wide text-subtle uppercase">
                {stat.label}
              </p>
              <p className="font-display text-[15px] font-bold tabular">
                <Counter value={stat.value} suffix={stat.suffix ?? ""} />
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
