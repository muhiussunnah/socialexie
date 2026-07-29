import { cn } from "@/lib/utils";

type Tone = "neutral" | "signal" | "live" | "ok" | "warn" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  signal: "bg-signal-soft text-signal border-signal-line",
  live: "bg-live-soft text-live border-transparent",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  info: "bg-info-soft text-info border-transparent",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-[11px] font-medium tracking-wide whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Small pulsing dot used to mark a channel or job as actively running. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-2", className)}>
      <span className="absolute inset-0 animate-pulse-live rounded-full bg-live" />
      <span className="relative inline-flex size-2 rounded-full bg-live" />
    </span>
  );
}
