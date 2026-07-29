import { TZDate } from "@date-fns/tz";

/**
 * Timezone-aware slot maths for the publishing queue.
 *
 * Every calendar calculation here goes through `TZDate` instead of adding
 * offsets by hand. A workspace on Europe/Stockholm expects its 09:00 slot to
 * stay at 09:00 through both DST switches, and only a real timezone database
 * can decide whether a given day is 23, 24 or 25 hours long. Adding
 * `24 * 60 * 60 * 1000` would silently drift the whole queue by an hour twice
 * a year.
 */

export interface Slot {
  /** ISO weekday, 1 = Monday … 7 = Sunday. `null` fires every day. */
  dayOfWeek: number | null;
  /** Wall clock in the workspace timezone, 24-hour `"HH:mm"`. */
  time: string;
}

export interface ZonedParts {
  year: number;
  /** 0-indexed, matching `Date#getMonth`. */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  /** ISO weekday, 1 = Monday … 7 = Sunday. */
  isoWeekday: number;
}

/**
 * Posting past this many times a day trips the spam heuristics on Meta's
 * networks, which throttle the account rather than the individual post.
 */
export const MAX_POSTS_PER_DAY = 6;

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Starter posting plan a new workspace gets, and what the demo screens show. */
export const DEFAULT_SLOTS: readonly Slot[] = [
  { dayOfWeek: null, time: "09:00" },
  { dayOfWeek: null, time: "12:30" },
  { dayOfWeek: null, time: "18:45" },
  { dayOfWeek: 2, time: "07:30" },
  { dayOfWeek: 4, time: "20:15" },
  { dayOfWeek: 6, time: "10:00" },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseSlotTime(time: string): { hours: number; minutes: number } {
  const match = TIME_PATTERN.exec(time);
  if (!match) {
    throw new Error(
      `Invalid slot time ${JSON.stringify(time)}. Expected a 24-hour "HH:mm" string such as "09:30".`,
    );
  }
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function assertDayOfWeek(dayOfWeek: number | null): void {
  if (dayOfWeek === null) return;
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error(
      `Invalid slot day ${dayOfWeek}. Expected an ISO weekday 1–7, or null for a daily slot.`,
    );
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoWeekdayOf(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Build the instant for a wall clock `addDays` after the anchor's civil date.
 *
 * The day arithmetic runs on a UTC date so a day is always exactly one day,
 * then `TZDate` maps that civil date + wall clock back to a real instant. On
 * a spring-forward day the requested clock time may not exist; the timezone
 * database resolves it forward, which is the same thing every scheduler does.
 */
function zonedWallClock(
  anchor: TZDate,
  addDays: number,
  hours: number,
  minutes: number,
  timeZone: string,
): TZDate {
  const civil = new Date(
    Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()),
  );
  civil.setUTCDate(civil.getUTCDate() + addDays);
  return new TZDate(
    civil.getUTCFullYear(),
    civil.getUTCMonth(),
    civil.getUTCDate(),
    hours,
    minutes,
    0,
    0,
    timeZone,
  );
}

/** The first moment strictly after `from` at which this slot fires. */
export function nextOccurrence(slot: Slot, from: Date, timeZone: string): Date {
  const { hours, minutes } = parseSlotTime(slot.time);
  assertDayOfWeek(slot.dayOfWeek);

  const anchor = new TZDate(from.getTime(), timeZone);
  const offsetDays =
    slot.dayOfWeek === null
      ? 0
      : (slot.dayOfWeek - isoWeekdayOf(anchor) + 7) % 7;

  const candidate = zonedWallClock(anchor, offsetDays, hours, minutes, timeZone);
  if (candidate.getTime() > from.getTime()) {
    return new Date(candidate.getTime());
  }

  const stride = slot.dayOfWeek === null ? 1 : 7;
  const next = zonedWallClock(
    anchor,
    offsetDays + stride,
    hours,
    minutes,
    timeZone,
  );
  return new Date(next.getTime());
}

/** The next `count` firing times across every slot, ascending and unique. */
export function buildQueue(
  slots: readonly Slot[],
  from: Date,
  timeZone: string,
  count: number,
): Date[] {
  if (count <= 0 || slots.length === 0) return [];

  const cursors = slots.map((slot) => nextOccurrence(slot, from, timeZone));
  const queue: Date[] = [];
  const seen = new Set<number>();
  // Two slots can share a time, so allow a pass per slot per requested opening.
  const maxSteps = (count + 1) * slots.length;

  for (let step = 0; step < maxSteps && queue.length < count; step++) {
    let earliest = 0;
    for (let i = 1; i < cursors.length; i++) {
      if (cursors[i].getTime() < cursors[earliest].getTime()) earliest = i;
    }

    const at = cursors[earliest];
    cursors[earliest] = nextOccurrence(slots[earliest], at, timeZone);

    if (seen.has(at.getTime())) continue;
    seen.add(at.getTime());
    queue.push(at);
  }

  return queue;
}

/** Drop items into the next free openings, in the order they were given. */
export function assignToSlots<T>(
  items: readonly T[],
  slots: readonly Slot[],
  from: Date,
  timeZone: string,
): { item: T; at: Date }[] {
  const queue = buildQueue(slots, from, timeZone, items.length);
  return queue.map((at, index) => ({ item: items[index], at }));
}

/** Posts on the busiest day of the week — daily slots count towards every day. */
export function slotsPerDay(slots: readonly Slot[]): number {
  const daily = slots.filter((slot) => slot.dayOfWeek === null).length;
  let peak = daily;
  for (let day = 1; day <= 7; day++) {
    const onDay = slots.filter((slot) => slot.dayOfWeek === day).length;
    peak = Math.max(peak, daily + onDay);
  }
  return peak;
}

export function slotsPerWeek(slots: readonly Slot[]): number {
  return slots.reduce((total, slot) => total + (slot.dayOfWeek === null ? 7 : 1), 0);
}

export function isTooFrequent(slots: readonly Slot[]): boolean {
  return slotsPerDay(slots) > MAX_POSTS_PER_DAY;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function describeCadence(slots: readonly Slot[]): string {
  if (slots.length === 0) {
    return "No slots yet — nothing will leave the queue until you add one.";
  }

  const perWeek = plural(slotsPerWeek(slots), "post");
  const perDay = plural(slotsPerDay(slots), "time");
  const everyDay = slots.every((slot) => slot.dayOfWeek === null);

  return everyDay
    ? `${perDay} a day, ${perWeek} a week`
    : `Up to ${perDay} a day, ${perWeek} a week`;
}

export function describeSlot(slot: Slot): string {
  assertDayOfWeek(slot.dayOfWeek);
  return slot.dayOfWeek === null
    ? `Every day · ${slot.time}`
    : `${DAY_NAMES[slot.dayOfWeek - 1]} · ${slot.time}`;
}

/** Stable identity for a slot, for React keys and de-duplication. */
export function slotKey(slot: Slot): string {
  return `${slot.dayOfWeek ?? "daily"}@${slot.time}`;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const zoned = new TZDate(date.getTime(), timeZone);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth(),
    day: zoned.getDate(),
    hours: zoned.getHours(),
    minutes: zoned.getMinutes(),
    isoWeekday: isoWeekdayOf(zoned),
  };
}

/** Midnight at the start of the day `date` falls on, in `timeZone`. */
export function startOfZonedDay(date: Date, timeZone: string): Date {
  const anchor = new TZDate(date.getTime(), timeZone);
  return new Date(zonedWallClock(anchor, 0, 0, 0, timeZone).getTime());
}

/** Same wall clock, `days` calendar days later — not a fixed 24h multiple. */
export function addZonedDays(date: Date, days: number, timeZone: string): Date {
  const anchor = new TZDate(date.getTime(), timeZone);
  const shifted = zonedWallClock(
    anchor,
    days,
    anchor.getHours(),
    anchor.getMinutes(),
    timeZone,
  );
  return new Date(shifted.getTime());
}

/** Turn a wall clock the user typed into the instant it means in `timeZone`. */
export function zonedInstant(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): Date {
  return new Date(
    new TZDate(year, month, day, hours, minutes, 0, 0, timeZone).getTime(),
  );
}

/** `"HH:mm"` in the workspace timezone. */
export function formatZonedTime(date: Date, timeZone: string): string {
  const { hours, minutes } = zonedParts(date, timeZone);
  return `${pad(hours)}:${pad(minutes)}`;
}

/** `"2026-07-29"` in the workspace timezone — the key calendars group by. */
export function zonedDayKey(date: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** `"Wed 29 Jul"`, built from constants so server and client always agree. */
export function formatZonedDate(date: Date, timeZone: string): string {
  const { day, month, isoWeekday } = zonedParts(date, timeZone);
  return `${DAY_ABBR[isoWeekday - 1]} ${day} ${MONTH_NAMES[month].slice(0, 3)}`;
}
