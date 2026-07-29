import { cn } from "@/lib/utils";

/**
 * Hand-rolled area chart. A charting library would add ~50kb of JS for what is
 * three path elements, and this renders on the server with zero hydration.
 */
export function AreaSpark({
  values,
  className,
  height = 64,
  stroke = "var(--signal)",
  label,
}: {
  values: readonly number[];
  className?: string;
  height?: number;
  stroke?: string;
  label?: string;
}) {
  if (values.length < 2) return null;

  const width = 240;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  // Leave 2px of headroom so the stroke never clips at the top or bottom.
  const toY = (v: number) => height - 2 - ((v - min) / span) * (height - 6);

  const points = values.map((v, i) => [i * stepX, toY(v)] as const);
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = points[points.length - 1];
  const gradientId = `spark-${values.length}-${Math.round(max)}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      role={label ? "img" : "presentation"}
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="3" fill={stroke} />
    </svg>
  );
}

/** Horizontal share-of-total bar used in the category breakdown. */
export function ShareBar({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
