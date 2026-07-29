"use client";

import { CircleCheck, Clock, Rocket, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { demoPosts } from "@/lib/demo";
import {
  assignToSlots,
  describeCadence,
  formatZonedDate,
  formatZonedTime,
  zonedInstant,
  type Slot,
} from "@/lib/scheduling";
import { cn } from "@/lib/utils";

export type ScheduleMode = "now" | "queue" | "at";

const MODES = [
  { value: "now" as const, label: "Publish now" },
  { value: "queue" as const, label: "Add to queue" },
  { value: "at" as const, label: "Schedule for…" },
];

const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function parseLocalInput(value: string, timeZone: string): Date | null {
  const match = DATETIME_PATTERN.exec(value);
  if (!match) return null;
  return zonedInstant(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    timeZone,
  );
}

function untilLabel(from: Date, to: Date): string {
  const minutes = Math.round((to.getTime() - from.getTime()) / 60_000);
  if (minutes < 1) return "any moment";
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `in ${hours}h` : `in ${hours}h ${rest}m`;
  }
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function SchedulePanel({
  now,
  timeZone,
  slots,
  mode,
  onModeChange,
  at,
  onAtChange,
  blocked,
  targetCount,
  onSubmit,
  receipt,
}: {
  now: Date;
  timeZone: string;
  slots: readonly Slot[];
  mode: ScheduleMode;
  onModeChange: (mode: ScheduleMode) => void;
  at: string;
  onAtChange: (value: string) => void;
  blocked: boolean;
  targetCount: number;
  onSubmit: () => void;
  receipt: string | null;
}) {
  // The draft takes the first opening; the rest of the queue shifts behind it.
  const openings = assignToSlots(
    ["This post", ...demoPosts.slice(0, 4).map((post) => post.title)],
    slots,
    now,
    timeZone,
  );
  const chosen = mode === "at" ? parseLocalInput(at, timeZone) : null;

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        name="When to publish"
        value={mode}
        options={MODES}
        onChange={onModeChange}
        size="sm"
        className="w-full"
      />

      {mode === "now" ? (
        <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[12.5px] text-muted">
          <Rocket className="mt-0.5 size-3.5 shrink-0 text-signal" />
          Goes out to {targetCount} channel{targetCount === 1 ? "" : "s"} as
          soon as you confirm. Nothing enters the queue.
        </p>
      ) : null}

      {mode === "at" ? (
        <div className="flex flex-col gap-2">
          <Input
            type="datetime-local"
            value={at}
            onChange={(event) => onAtChange(event.target.value)}
            aria-label="Publish date and time"
          />
          <p className="text-[12px] text-subtle">
            {chosen
              ? `${formatZonedDate(chosen, timeZone)} at ${formatZonedTime(chosen, timeZone)} · ${timeZone} · ${untilLabel(now, chosen)}`
              : `Times are read in ${timeZone}, the workspace timezone.`}
          </p>
        </div>
      ) : null}

      {mode === "queue" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] tracking-wide text-subtle uppercase">
              Next openings
            </p>
            <p className="text-[11.5px] text-subtle">{describeCadence(slots)}</p>
          </div>

          <ul className="flex flex-col gap-1">
            {openings.map((opening, index) => (
              <li
                key={opening.at.getTime()}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-2.5 py-2",
                  index === 0
                    ? "border-signal-line bg-signal-soft"
                    : "border-transparent",
                )}
              >
                <Clock
                  className={cn(
                    "size-3.5 shrink-0",
                    index === 0 ? "text-signal" : "text-subtle",
                  )}
                />
                <span className="font-mono text-[11.5px] tabular">
                  {formatZonedDate(opening.at, timeZone)}{" "}
                  {formatZonedTime(opening.at, timeZone)}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[12.5px]",
                    index === 0 ? "font-medium text-signal" : "text-subtle",
                  )}
                >
                  {opening.item}
                </span>
              </li>
            ))}
          </ul>

          {openings.length > 0 ? (
            <p className="flex items-center gap-1.5 text-[11.5px] text-subtle">
              <Timer className="size-3" />
              First opening {untilLabel(now, openings[0].at)} · {timeZone}
            </p>
          ) : (
            <p className="text-[12px] text-warn">
              No slots in the posting plan yet — add one on the calendar.
            </p>
          )}
        </div>
      ) : null}

      <Button
        onClick={onSubmit}
        disabled={blocked || targetCount === 0}
        className="w-full"
      >
        {mode === "now"
          ? "Publish now"
          : mode === "queue"
            ? "Add to queue"
            : "Schedule post"}
      </Button>

      {blocked ? (
        <p className="text-center text-[11.5px] text-danger">
          Clear the blocking problems first.
        </p>
      ) : null}

      {receipt ? (
        <p className="flex items-start gap-2 rounded-lg border border-ok bg-ok-soft px-3 py-2.5 text-[12.5px] text-ok">
          <CircleCheck className="mt-0.5 size-3.5 shrink-0" />
          {receipt}
        </p>
      ) : null}
    </div>
  );
}
