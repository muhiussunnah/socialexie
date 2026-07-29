"use client";

import {
  EventChip,
  layoutColumns,
  type CalendarEvent,
} from "@/components/calendar/events";
import { DAY_ABBR, zonedDayKey, zonedParts } from "@/lib/scheduling";
import { cn } from "@/lib/utils";

const START_HOUR = 6;
const END_HOUR = 23;
const ROW_HEIGHT = 52;

const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, index) => START_HOUR + index,
);

const COLUMNS = "52px repeat(7, minmax(0, 1fr))";

export function WeekGrid({
  days,
  events,
  timeZone,
  now,
  selectedId,
  onSelect,
}: {
  days: readonly Date[];
  events: readonly CalendarEvent[];
  timeZone: string;
  now: Date;
  selectedId: string | null;
  onSelect: (event: CalendarEvent, anchor: DOMRect) => void;
}) {
  const todayKey = zonedDayKey(now, timeZone);
  const nowParts = zonedParts(now, timeZone);
  const nowOffset =
    (nowParts.hours + nowParts.minutes / 60 - START_HOUR) /
    (END_HOUR - START_HOUR);

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div
        className="grid border-b border-line bg-surface-2"
        style={{ gridTemplateColumns: COLUMNS }}
      >
        <span aria-hidden />
        {days.map((day) => {
          const parts = zonedParts(day, timeZone);
          const isToday = zonedDayKey(day, timeZone) === todayKey;
          return (
            <div
              key={day.getTime()}
              className="border-l border-line px-2 py-2 text-center"
            >
              <p className="text-[10.5px] tracking-[0.1em] text-subtle uppercase">
                {DAY_ABBR[parts.isoWeekday - 1]}
              </p>
              <p
                className={cn(
                  "mx-auto mt-0.5 grid size-6 place-items-center rounded-full font-mono text-[12.5px] tabular",
                  isToday ? "bg-signal font-semibold text-signal-fg" : "text-fg",
                )}
              >
                {parts.day}
              </p>
            </div>
          );
        })}
      </div>

      <div className="max-h-[620px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: COLUMNS }}>
          <div>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="relative"
                style={{ height: ROW_HEIGHT }}
              >
                <span className="absolute -top-1.5 right-2 font-mono text-[10.5px] text-subtle tabular">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const key = zonedDayKey(day, timeZone);
            const dayEvents = events.filter(
              (event) => zonedDayKey(event.at, timeZone) === key,
            );
            const placed = layoutColumns(dayEvents);
            const isToday = key === todayKey;

            return (
              <div key={day.getTime()} className="relative border-l border-line">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className={cn(
                      "border-b border-line",
                      isToday && "bg-signal-soft/25",
                    )}
                    style={{ height: ROW_HEIGHT }}
                  />
                ))}

                {isToday && nowOffset >= 0 && nowOffset <= 1 ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t border-live"
                    style={{ top: `${nowOffset * 100}%` }}
                  >
                    <span className="absolute -top-1 -left-1 size-2 rounded-full bg-live" />
                  </div>
                ) : null}

                <div className="absolute inset-0">
                  {placed.map(({ event, column, columns }) => {
                    const parts = zonedParts(event.at, timeZone);
                    const offset =
                      (parts.hours + parts.minutes / 60 - START_HOUR) /
                      (END_HOUR - START_HOUR);

                    return (
                      <EventChip
                        key={event.id}
                        event={event}
                        timeZone={timeZone}
                        selected={selectedId === event.id}
                        onSelect={onSelect}
                        showTime={columns === 1}
                        className="absolute shadow-e1"
                        style={{
                          top: `${Math.min(97, Math.max(0, offset * 100))}%`,
                          left: `calc(${(column / columns) * 100}% + 2px)`,
                          width: `calc(${100 / columns}% - 4px)`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
