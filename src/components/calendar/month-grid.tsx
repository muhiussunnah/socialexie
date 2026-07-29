"use client";

import { EventChip, type CalendarEvent } from "@/components/calendar/events";
import { DAY_ABBR, zonedDayKey, zonedParts } from "@/lib/scheduling";
import { cn } from "@/lib/utils";

const VISIBLE_PER_DAY = 3;

export function MonthGrid({
  days,
  month,
  events,
  timeZone,
  now,
  selectedId,
  onSelect,
  onExpandDay,
}: {
  days: readonly Date[];
  /** 0-indexed month the grid is centred on; other days render dimmed. */
  month: number;
  events: readonly CalendarEvent[];
  timeZone: string;
  now: Date;
  selectedId: string | null;
  onSelect: (event: CalendarEvent, anchor: DOMRect) => void;
  onExpandDay: (day: Date, events: CalendarEvent[], anchor: DOMRect) => void;
}) {
  const todayKey = zonedDayKey(now, timeZone);

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = zonedDayKey(event.at, timeZone);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line bg-surface-2">
        {DAY_ABBR.map((label) => (
          <p
            key={label}
            className="px-2 py-2 text-center text-[10.5px] tracking-[0.1em] text-subtle uppercase"
          >
            {label}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = zonedDayKey(day, timeZone);
          const parts = zonedParts(day, timeZone);
          const dayEvents = byDay.get(key) ?? [];
          const overflow = dayEvents.length - VISIBLE_PER_DAY;
          const isToday = key === todayKey;
          const outside = parts.month !== month;

          return (
            <div
              key={key}
              className={cn(
                "min-h-[116px] border-r border-b border-line p-1.5 last:border-r-0",
                outside && "bg-bg-sub",
              )}
            >
              <div className="flex items-center justify-between px-0.5 pb-1">
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full font-mono text-[11.5px] tabular",
                    isToday && "bg-signal font-semibold text-signal-fg",
                    !isToday && outside && "text-subtle",
                  )}
                >
                  {parts.day}
                </span>
                {dayEvents.length > 0 ? (
                  <span className="font-mono text-[10px] text-subtle tabular">
                    {dayEvents.length}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                {dayEvents.slice(0, VISIBLE_PER_DAY).map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    timeZone={timeZone}
                    selected={selectedId === event.id}
                    onSelect={onSelect}
                  />
                ))}

                {overflow > 0 ? (
                  <button
                    type="button"
                    onClick={(mouseEvent) =>
                      onExpandDay(
                        day,
                        dayEvents,
                        mouseEvent.currentTarget.getBoundingClientRect(),
                      )
                    }
                    className="rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    +{overflow} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
