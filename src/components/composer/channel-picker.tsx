"use client";

import { Check, Plug } from "lucide-react";
import Link from "next/link";
import { ChannelIcon } from "@/components/channel-icon";
import { demoChannels } from "@/lib/demo";
import { getPlatform, PLATFORM_LIST, type PlatformId } from "@/lib/platforms";
import { cn, compactNumber } from "@/lib/utils";

const CONNECTED = new Map(demoChannels.map((channel) => [channel.platform, channel]));

export function ChannelPicker({
  selected,
  onToggle,
}: {
  selected: readonly PlatformId[];
  onToggle: (platform: PlatformId) => void;
}) {
  const unconnected = selected.filter((id) => !CONNECTED.has(id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PLATFORM_LIST.map((spec) => {
          const channel = CONNECTED.get(spec.id);
          const active = selected.includes(spec.id);

          return (
            <button
              key={spec.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(spec.id)}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                active
                  ? "shadow-e1"
                  : "border-line bg-surface-2 hover:border-line-strong",
                !channel && !active && "border-dashed",
              )}
              style={
                active
                  ? {
                      borderColor: `color-mix(in srgb, ${spec.hex} 45%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${spec.hex} 10%, transparent)`,
                    }
                  : undefined
              }
            >
              <ChannelIcon platform={spec.id} size="sm" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  {spec.name}
                  {active ? (
                    <Check className="size-3.5" style={{ color: spec.hex }} />
                  ) : null}
                </span>
                <span className="block truncate text-[11px] text-subtle">
                  {channel
                    ? channel.status === "expired"
                      ? "Token expired"
                      : `${compactNumber(channel.followers)} followers`
                    : "Not connected"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {unconnected.length > 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-muted">
          <Plug className="mt-0.5 size-3.5 shrink-0 text-subtle" />
          <span>
            {unconnected.map((id) => getPlatform(id).name).join(" and ")}{" "}
            {unconnected.length === 1 ? "is" : "are"} not connected. The draft
            saves either way —{" "}
            <Link
              href="/dashboard/channels"
              className="font-medium text-signal underline-offset-2 hover:underline"
            >
              connect the account
            </Link>{" "}
            before this one can publish.
          </span>
        </p>
      ) : null}
    </div>
  );
}
