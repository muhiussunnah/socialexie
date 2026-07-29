"use client";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional trailing note, e.g. a savings hint on the pricing toggle. */
  note?: string;
}

/**
 * Two-or-more state switch rendered as a real radio group so it is keyboard
 * and screen-reader operable, with the selection drawn as a sliding pill.
 */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  name: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn(
        "relative inline-grid rounded-full border border-line bg-surface-2 p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full bg-signal shadow-e1 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(calc(${index} * 100%))`,
          left: "0.25rem",
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors",
              size === "sm" ? "h-7 px-3 text-[12px]" : "h-9 px-5 text-[13px]",
              active ? "text-signal-fg" : "text-muted hover:text-fg",
            )}
          >
            {option.label}
            {option.note ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  active
                    ? "bg-black/15 text-signal-fg"
                    : "bg-signal-soft text-signal",
                )}
              >
                {option.note}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
