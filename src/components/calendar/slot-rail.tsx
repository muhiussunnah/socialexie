"use client";

import { useState } from "react";
import { Clock, Plus, TriangleAlert, X } from "lucide-react";
import { STATUS_DOT } from "@/components/calendar/events";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import {
  buildQueue,
  DAY_NAMES,
  describeCadence,
  formatZonedDate,
  formatZonedTime,
  isTooFrequent,
  MAX_POSTS_PER_DAY,
  slotKey,
  slotsPerDay,
  slotsPerWeek,
  type Slot,
} from "@/lib/scheduling";
import { cn } from "@/lib/utils";

const LEGEND: { status: keyof typeof STATUS_DOT; label: string }[] = [
  { status: "scheduled", label: "Scheduled" },
  { status: "published", label: "Published" },
  { status: "recycling", label: "Recycling" },
  { status: "draft", label: "Draft" },
];

function sortSlots(slots: readonly Slot[]): Slot[] {
  return [...slots].sort((a, b) => {
    const dayA = a.dayOfWeek ?? 0;
    const dayB = b.dayOfWeek ?? 0;
    if (dayA !== dayB) return dayA - dayB;
    return a.time.localeCompare(b.time);
  });
}

export function SlotRail({
  slots,
  onSlotsChange,
  timeZone,
  now,
}: {
  slots: readonly Slot[];
  onSlotsChange: (slots: Slot[]) => void;
  timeZone: string;
  now: Date;
}) {
  const [day, setDay] = useState("daily");
  const [time, setTime] = useState("08:00");

  const ordered = sortSlots(slots);
  const crowded = isTooFrequent(slots);
  const openings = buildQueue(slots, now, timeZone, 6);

  function addSlot() {
    const slot: Slot = {
      dayOfWeek: day === "daily" ? null : Number(day),
      time,
    };
    if (slots.some((existing) => slotKey(existing) === slotKey(slot))) return;
    onSlotsChange([...slots, slot]);
  }

  function removeSlot(key: string) {
    onSlotsChange(slots.filter((slot) => slotKey(slot) !== key));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Posting plan</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-[13px] text-muted">{describeCadence(slots)}</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface-2 px-3 py-2">
              <p className="text-[10.5px] tracking-wide text-subtle uppercase">
                Busiest day
              </p>
              <p className="font-display text-[18px] font-bold tabular">
                {slotsPerDay(slots)}
              </p>
            </div>
            <div className="rounded-lg bg-surface-2 px-3 py-2">
              <p className="text-[10.5px] tracking-wide text-subtle uppercase">
                Per week
              </p>
              <p className="font-display text-[18px] font-bold tabular">
                {slotsPerWeek(slots)}
              </p>
            </div>
          </div>

          {crowded ? (
            <div className="rounded-lg border border-warn bg-warn-soft p-3">
              <p className="flex items-center gap-2 text-[12.5px] font-semibold text-warn">
                <TriangleAlert className="size-4" />
                {slotsPerDay(slots)} posts on your busiest day
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                Past roughly {MAX_POSTS_PER_DAY} a day the networks start
                treating the account as spam and hold back the whole feed, not
                just the extra posts. Thin the plan or split the load across
                more channels.
              </p>
            </div>
          ) : null}

          <ul className="flex flex-col gap-1">
            {ordered.map((slot) => (
              <li
                key={slotKey(slot)}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
              >
                <Clock className="size-3.5 shrink-0 text-subtle" />
                <span className="font-mono text-[12px] tabular">{slot.time}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                  {slot.dayOfWeek === null
                    ? "Every day"
                    : DAY_NAMES[slot.dayOfWeek - 1]}
                </span>
                <button
                  type="button"
                  onClick={() => removeSlot(slotKey(slot))}
                  aria-label={`Remove the ${slot.time} slot`}
                  className="rounded p-0.5 text-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex gap-1.5 border-t border-line pt-3">
            <Select
              value={day}
              onChange={(event) => setDay(event.target.value)}
              aria-label="Slot day"
              className="h-9 flex-1 text-[12.5px]"
            >
              <option value="daily">Every day</option>
              {DAY_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </Select>
            <Input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              aria-label="Slot time"
              className="h-9 w-[104px] text-[12.5px]"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={addSlot}
              className="h-9 px-2.5"
              aria-label="Add slot"
            >
              <Plus />
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Next openings</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-1">
          {openings.length === 0 ? (
            <p className="text-[12.5px] text-subtle">
              Add a slot and the queue starts moving again.
            </p>
          ) : (
            openings.map((at) => (
              <p
                key={at.getTime()}
                className="flex items-baseline justify-between gap-2 rounded-md px-1 py-1 font-mono text-[12px] tabular"
              >
                <span className="text-muted">
                  {formatZonedDate(at, timeZone)}
                </span>
                <span>{formatZonedTime(at, timeZone)}</span>
              </p>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5">
          <p className="text-[10.5px] tracking-[0.1em] text-subtle uppercase">
            Legend
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-1.5">
            {LEGEND.map((item) => (
              <li
                key={item.status}
                className="flex items-center gap-2 text-[12px] text-muted"
              >
                <span
                  className={cn("size-1.5 rounded-full", STATUS_DOT[item.status])}
                />
                {item.label}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
