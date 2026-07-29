import { cn } from "@/lib/utils";
import { site } from "@/lib/site";

/**
 * The mark is a broadcast signal: a solid core with three widening arcs.
 * One arc is drawn in the live colour to read as "currently transmitting".
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-8", className)}
    >
      <rect width="32" height="32" rx="9" className="fill-fg" />
      <circle cx="11" cy="16" r="2.6" className="fill-signal" />
      <path
        d="M16.4 11.2a7.2 7.2 0 0 1 0 9.6"
        className="stroke-signal"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M20.4 8.2a11.4 11.4 0 0 1 0 15.6"
        className="stroke-signal"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M24.4 5.4a15.2 15.2 0 0 1 0 21.2"
        className="stroke-live"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showWordmark ? (
        <span className="font-display text-[17px] font-bold tracking-[-0.03em]">
          {site.name}
        </span>
      ) : null}
    </span>
  );
}
