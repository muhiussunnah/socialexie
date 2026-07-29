"use client";

import { RotateCcw } from "lucide-react";
import { ChannelIcon } from "@/components/channel-icon";
import { Textarea } from "@/components/ui/field";
import {
  countGraphemes,
  extractHashtags,
  strictestCaptionLimit,
} from "@/lib/post-validation";
import { getPlatform, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

export type EditorTab = "base" | PlatformId;

/** The network whose caption ceiling the base counter has to respect. */
function tightestTarget(targets: readonly PlatformId[]): PlatformId | null {
  return targets.reduce<PlatformId | null>(
    (tightest, id) =>
      tightest === null ||
      getPlatform(id).captionLimit < getPlatform(tightest).captionLimit
        ? id
        : tightest,
    null,
  );
}

export function Editor({
  targets,
  base,
  overrides,
  active,
  onActiveChange,
  onBaseChange,
  onOverrideChange,
  onOverrideReset,
}: {
  targets: readonly PlatformId[];
  base: string;
  overrides: Partial<Record<PlatformId, string>>;
  active: EditorTab;
  onActiveChange: (tab: EditorTab) => void;
  onBaseChange: (value: string) => void;
  onOverrideChange: (platform: PlatformId, value: string) => void;
  onOverrideReset: (platform: PlatformId) => void;
}) {
  const platform: PlatformId | null = active === "base" ? null : active;
  const overridden = platform !== null && overrides[platform] !== undefined;
  const value =
    platform === null ? base : (overrides[platform] ?? base);

  const limit =
    platform === null
      ? strictestCaptionLimit(targets)
      : getPlatform(platform).captionLimit;
  const tightest = platform ?? tightestTarget(targets);

  const length = countGraphemes(value);
  const ratio = limit ? length / limit : 0;
  const tone = ratio >= 1 ? "danger" : ratio >= 0.9 ? "warn" : "neutral";
  const hashtags = extractHashtags(value);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        <TabButton
          active={platform === null}
          onClick={() => onActiveChange("base")}
          label="All channels"
        />
        {targets.map((id) => (
          <TabButton
            key={id}
            active={platform === id}
            onClick={() => onActiveChange(id)}
            label={getPlatform(id).name}
            icon={<ChannelIcon platform={id} size="sm" />}
            marked={overrides[id] !== undefined}
          />
        ))}
      </div>

      <div className="relative">
        <Textarea
          value={value}
          rows={9}
          placeholder={
            platform === null
              ? "Write once. Tune it per network on the tabs above."
              : `Write a ${getPlatform(platform).name} version…`
          }
          onChange={(event) =>
            platform === null
              ? onBaseChange(event.target.value)
              : onOverrideChange(platform, event.target.value)
          }
          className="min-h-[200px] text-[14px]"
        />
        {platform !== null && !overridden ? (
          <span className="pointer-events-none absolute top-2.5 right-3 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-subtle">
            inheriting base
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-[180px] flex-1 items-center gap-2.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                tone === "danger"
                  ? "bg-danger"
                  : tone === "warn"
                    ? "bg-warn"
                    : "bg-signal",
              )}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
          </div>
          <span
            className={cn(
              "font-mono text-[11.5px] tabular",
              tone === "danger"
                ? "text-danger"
                : tone === "warn"
                  ? "text-warn"
                  : "text-subtle",
            )}
          >
            {length.toLocaleString()}
            {limit === null ? "" : ` / ${limit.toLocaleString()}`}
          </span>
        </div>

        {tightest !== null ? (
          <p className="text-[11.5px] text-subtle">
            Counting against {getPlatform(tightest).name}
          </p>
        ) : null}

        {platform !== null && overridden ? (
          <button
            type="button"
            onClick={() => onOverrideReset(platform)}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-muted transition-colors hover:text-fg"
          >
            <RotateCcw className="size-3" />
            Reset to base
          </button>
        ) : null}
      </div>

      {hashtags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] tracking-wide text-subtle uppercase">
            {hashtags.length} tags
          </span>
          {hashtags.slice(0, 12).map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="rounded-full bg-info-soft px-2 py-0.5 font-mono text-[11px] text-info"
            >
              {tag}
            </span>
          ))}
          {hashtags.length > 12 ? (
            <span className="text-[11px] text-subtle">
              +{hashtags.length - 12}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
  marked,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  marked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors",
        active
          ? "bg-surface-3 font-medium text-fg"
          : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {icon}
      {label}
      {marked ? (
        <span className="size-1.5 rounded-full bg-signal" aria-label="edited" />
      ) : null}
    </button>
  );
}
