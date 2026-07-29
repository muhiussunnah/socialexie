import { CalendarClock, Image as ImageIcon, Repeat2, Zap } from "lucide-react";
import { ChannelIcon, ChannelStack } from "@/components/channel-icon";
import { LiveDot } from "@/components/ui/badge";
import type { PlatformId } from "@/lib/platforms";

interface QueueRow {
  time: string;
  title: string;
  channels: PlatformId[];
  state: "queued" | "recycling" | "generating" | "live";
}

const ROWS: QueueRow[] = [
  {
    time: "09:00",
    title: "7 things nobody tells you about a 3-year-old",
    channels: ["instagram", "facebook", "threads"],
    state: "live",
  },
  {
    time: "12:30",
    title: "Phone-free dinner challenge — day 4",
    channels: ["tiktok", "youtube", "instagram"],
    state: "queued",
  },
  {
    time: "15:15",
    title: "Save this: 5 things to say instead of 'good job'",
    channels: ["pinterest", "linkedin", "x"],
    state: "recycling",
  },
  {
    time: "19:00",
    title: "Sunset park carousel · 4 frames",
    channels: ["instagram", "facebook"],
    state: "generating",
  },
];

const STATE_STYLES: Record<QueueRow["state"], { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-surface-3 text-muted" },
  recycling: { label: "Recycling", className: "bg-info-soft text-info" },
  generating: { label: "Generating", className: "bg-signal-soft text-signal" },
  live: { label: "Published", className: "bg-ok-soft text-ok" },
};

const CHANNELS: PlatformId[] = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "x",
  "linkedin",
  "pinterest",
  "threads",
];

/**
 * A real, statically rendered slice of the product rather than a screenshot —
 * it stays crisp at any density and costs no image bytes.
 */
export function ConsolePreview() {
  return (
    <div className="rounded-panel border border-line bg-surface shadow-e3">
      {/* Desk header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-signal text-[11px] font-bold text-signal-fg">
            A
          </span>
          <span className="text-[13px] font-medium">Approved By Families</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-live-soft px-2 py-0.5 text-[11px] font-medium text-live">
          <LiveDot />
          Queue healthy
        </span>
        <span className="ml-auto hidden font-mono text-[11px] text-subtle tabular sm:block">
          next in 00:12:41
        </span>
      </div>

      <div className="grid gap-0 md:grid-cols-[168px_1fr]">
        {/* Channel rail */}
        <div className="border-line p-3 md:border-r">
          <p className="px-1 pb-2 text-[10px] font-semibold tracking-[0.14em] text-subtle uppercase">
            Channels
          </p>
          <div className="flex gap-1.5 md:flex-col">
            {CHANNELS.slice(0, 5).map((p) => (
              <div
                key={p}
                className="flex flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 md:flex-none"
              >
                <ChannelIcon platform={p} size="sm" />
                <span className="hidden text-[12px] text-muted md:block">
                  {p === "x" ? "X" : p[0].toUpperCase() + p.slice(1)}
                </span>
                <span className="ml-auto hidden size-1.5 rounded-full bg-ok md:block" />
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
            {ROWS.map((row) => {
              const state = STATE_STYLES[row.state];
              return (
                <li
                  key={row.time}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-line hover:bg-surface-2"
                >
                  <span className="font-mono text-[11px] text-subtle tabular">
                    {row.time}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {row.title}
                  </span>
                  <ChannelStack platforms={row.channels} className="hidden sm:inline-flex" />
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${state.className}`}
                  >
                    {state.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Instrument strip */}
      <div className="grid grid-cols-2 gap-px border-t border-line bg-line md:grid-cols-4">
        {[
          { icon: CalendarClock, label: "Scheduled", value: "1,284" },
          { icon: Repeat2, label: "Recycling", value: "37 rules" },
          { icon: ImageIcon, label: "AI images", value: "512" },
          { icon: Zap, label: "Automations", value: "9 live" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-2.5 bg-surface px-4 py-3">
            <stat.icon className="size-4 text-subtle" />
            <div className="min-w-0">
              <p className="truncate text-[10px] tracking-wide text-subtle uppercase">
                {stat.label}
              </p>
              <p className="font-display text-[15px] font-bold tabular">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
