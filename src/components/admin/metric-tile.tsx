import { cn } from "@/lib/utils";

type Tone = "default" | "signal" | "live";

const toneRing: Record<Tone, string> = {
  default: "border-line",
  signal: "border-signal-line bg-signal-soft/40",
  live: "border-line bg-live-soft/30",
};

export function MetricGrid({
  columns = 4,
  children,
}: {
  columns?: 3 | 4;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        columns === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  sub,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border bg-surface p-3.5 shadow-e1",
        toneRing[tone],
        className,
      )}
    >
      <p className="text-[10.5px] font-semibold tracking-[0.12em] text-subtle uppercase">
        {label}
      </p>
      <p className="mt-1.5 font-display text-[24px] leading-none font-extrabold tabular">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[11.5px] text-subtle">{sub}</p> : null}
    </div>
  );
}
