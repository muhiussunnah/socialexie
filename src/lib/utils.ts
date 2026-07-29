import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 1234567 -> "1.23M". Keeps metric tiles readable at a glance. */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${trimZero(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trimZero(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimZero(value / 1_000)}K`;
  return String(value);
}

function trimZero(n: number): string {
  const fixed = n.toFixed(n < 10 ? 2 : 1);
  return fixed.replace(/\.?0+$/, "");
}

/** Money for pricing tables: whole dollars, thousands separated. */
export function formatPrice(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Stable initials for avatars without pulling an image. */
export function initials(name: string | null | undefined, fallback = "S"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
