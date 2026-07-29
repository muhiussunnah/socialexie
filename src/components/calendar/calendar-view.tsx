"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight, PenSquare } from "lucide-react";
import { buildEvents, type CalendarEvent } from "@/components/calendar/events";
import { DayDetail, EventDetail } from "@/components/calendar/event-detail";
import { MonthGrid } from "@/components/calendar/month-grid";
import { SlotRail } from "@/components/calendar/slot-rail";
import { WeekGrid } from "@/components/calendar/week-grid";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import {
  addZonedDays,
  DEFAULT_SLOTS,
  formatZonedDate,
  MONTH_NAMES,
  startOfZonedDay,
  zonedInstant,
  zonedParts,
  type Slot,
} from "@/lib/scheduling";

type View = "month" | "week";

type Selection =
  | { kind: "event"; event: CalendarEvent; anchor: DOMRect }
  | { kind: "day"; day: Date; events: CalendarEvent[]; anchor: DOMRect };

const VIEW_OPTIONS = [
  { value: "month" as const, label: "Month" },
  { value: "week" as const, label: "Week" },
];

function shiftMonths(cursor: Date, delta: number, timeZone: string): Date {
  const parts = zonedParts(cursor, timeZone);
  const civil = new Date(Date.UTC(parts.year, parts.month + delta, 1));
  // Noon keeps the anchor clear of any DST transition at midnight.
  return zonedInstant(
    civil.getUTCFullYear(),
    civil.getUTCMonth(),
    1,
    12,
    0,
    timeZone,
  );
}

export function CalendarView({
  nowIso,
  timeZone,
}: {
  nowIso: string;
  timeZone: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(now);
  const [slots, setSlots] = useState<Slot[]>([...DEFAULT_SLOTS]);
  const [selection, setSelection] = useState<Selection | null>(null);

  const { days, gridStart, month, label } = useMemo(() => {
    const parts = zonedParts(cursor, timeZone);

    if (view === "week") {
      const start = addZonedDays(
        startOfZonedDay(cursor, timeZone),
        -(parts.isoWeekday - 1),
        timeZone,
      );
      const week = Array.from({ length: 7 }, (_, index) =>
        addZonedDays(start, index, timeZone),
      );
      return {
        days: week,
        gridStart: start,
        month: parts.month,
        label: `${formatZonedDate(week[0], timeZone)} – ${formatZonedDate(week[6], timeZone)}`,
      };
    }

    const first = zonedInstant(parts.year, parts.month, 1, 0, 0, timeZone);
    const start = addZonedDays(
      first,
      -(zonedParts(first, timeZone).isoWeekday - 1),
      timeZone,
    );
    return {
      days: Array.from({ length: 42 }, (_, index) =>
        addZonedDays(start, index, timeZone),
      ),
      gridStart: start,
      month: parts.month,
      label: `${MONTH_NAMES[parts.month]} ${parts.year}`,
    };
  }, [cursor, timeZone, view]);

  const events = useMemo(() => {
    const from = new Date(gridStart.getTime() - 1);
    const to = new Date(
      addZonedDays(gridStart, days.length, timeZone).getTime() - 1,
    );
    return buildEvents(slots, from, to, timeZone, now);
  }, [gridStart, days.length, slots, timeZone, now]);

  function step(direction: -1 | 1) {
    setSelection(null);
    setCursor((current) =>
      view === "week"
        ? addZonedDays(current, direction * 7, timeZone)
        : shiftMonths(current, direction, timeZone),
    );
  }

  const selectEvent = (event: CalendarEvent, anchor: DOMRect) =>
    setSelection({ kind: "event", event, anchor });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold">Calendar</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {events.length} entries in view · {timeZone}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/composer">
            <PenSquare />
            New post
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => step(-1)}
            aria-label={view === "week" ? "Previous week" : "Previous month"}
            className="px-2"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => step(1)}
            aria-label={view === "week" ? "Next week" : "Next month"}
            className="px-2"
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelection(null);
              setCursor(now);
            }}
          >
            <CalendarCheck />
            Today
          </Button>
        </div>

        <p className="font-display text-[17px] font-bold">{label}</p>

        <Segmented
          name="Calendar view"
          value={view}
          options={VIEW_OPTIONS}
          onChange={(next) => {
            setSelection(null);
            setView(next);
          }}
          size="sm"
          className="ml-auto"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_296px]">
        <div className="min-w-0">
          {view === "week" ? (
            <WeekGrid
              days={days}
              events={events}
              timeZone={timeZone}
              now={now}
              selectedId={
                selection?.kind === "event" ? selection.event.id : null
              }
              onSelect={selectEvent}
            />
          ) : (
            <MonthGrid
              days={days}
              month={month}
              events={events}
              timeZone={timeZone}
              now={now}
              selectedId={
                selection?.kind === "event" ? selection.event.id : null
              }
              onSelect={selectEvent}
              onExpandDay={(day, dayEvents, anchor) =>
                setSelection({ kind: "day", day, events: dayEvents, anchor })
              }
            />
          )}
        </div>

        <SlotRail
          slots={slots}
          onSlotsChange={setSlots}
          timeZone={timeZone}
          now={now}
        />
      </div>

      {selection?.kind === "event" ? (
        <EventDetail
          event={selection.event}
          anchor={selection.anchor}
          timeZone={timeZone}
          onClose={() => setSelection(null)}
        />
      ) : null}

      {selection?.kind === "day" ? (
        <DayDetail
          day={selection.day}
          events={selection.events}
          anchor={selection.anchor}
          timeZone={timeZone}
          onClose={() => setSelection(null)}
          onSelect={selectEvent}
        />
      ) : null}
    </div>
  );
}
