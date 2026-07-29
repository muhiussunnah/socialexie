import { compactNumber } from "@/lib/utils";

/**
 * Formatting for the console.
 *
 * Everything renders in UTC from a fixed locale so a value looks identical on
 * the server and after hydration, and so two operators in different time zones
 * are always talking about the same row.
 */

const DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATE_SHORT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const at = Date.parse(iso);
  return Number.isNaN(at) ? "—" : DATE.format(at);
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const at = Date.parse(iso);
  return Number.isNaN(at) ? "—" : DATE_SHORT.format(at);
}

/** `2026-07-29 09:14:22Z` — sliced from the ISO string so it stays sortable. */
export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  const text = at.toISOString();
  return `${text.slice(0, 10)} ${text.slice(11, 19)}Z`;
}

/** Byte counts share the metric-tile formatter so magnitudes read the same way. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  return `${compactNumber(bytes)}B`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** One-line JSON preview for audit metadata, clipped to stay inside the cell. */
export function previewJson(value: Record<string, unknown>, max = 92): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  const text = entries
    .map(([key, val]) => `${key}=${typeof val === "string" ? val : JSON.stringify(val)}`)
    .join("  ");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
