import { getPlatform, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/** Short monogram per network — kept uppercase and two characters at most. */
const MONOGRAM: Record<PlatformId, string> = {
  facebook: "f",
  instagram: "ig",
  tiktok: "tt",
  youtube: "yt",
  x: "X",
  linkedin: "in",
  pinterest: "P",
  threads: "@",
};

const SIZES = {
  sm: "size-6 text-[10px] rounded-[7px]",
  md: "size-8 text-[12px] rounded-[9px]",
  lg: "size-10 text-[14px] rounded-[11px]",
} as const;

/**
 * Channel identity tile. The network's own colour does the identifying work,
 * so these stay legible at 24px where a full logo would turn to mud.
 */
export function ChannelIcon({
  platform,
  size = "md",
  className,
}: {
  platform: PlatformId;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const spec = getPlatform(platform);
  return (
    <span
      className={cn(
        "inline-grid place-items-center border font-display font-bold lowercase select-none",
        SIZES[size],
        className,
      )}
      style={{
        color: spec.hex,
        backgroundColor: `color-mix(in srgb, ${spec.hex} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${spec.hex} 34%, transparent)`,
      }}
      title={spec.name}
      aria-label={spec.name}
    >
      {MONOGRAM[platform]}
    </span>
  );
}

/** Overlapping stack used to show "posting to these 5 channels" compactly. */
export function ChannelStack({
  platforms,
  size = "sm",
  max = 6,
  className,
}: {
  platforms: readonly PlatformId[];
  size?: keyof typeof SIZES;
  max?: number;
  className?: string;
}) {
  const shown = platforms.slice(0, max);
  const overflow = platforms.length - shown.length;

  return (
    <span className={cn("inline-flex items-center", className)}>
      {shown.map((p, i) => (
        <ChannelIcon
          key={p}
          platform={p}
          size={size}
          className={cn("ring-2 ring-surface", i > 0 && "-ml-1.5")}
        />
      ))}
      {overflow > 0 ? (
        <span className="-ml-1.5 inline-grid size-6 place-items-center rounded-[7px] border border-line bg-surface-2 text-[10px] font-semibold text-muted ring-2 ring-surface">
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
