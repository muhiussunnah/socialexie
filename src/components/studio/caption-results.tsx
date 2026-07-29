"use client";

import { useState } from "react";
import { Check, Copy, PencilLine, SendHorizontal, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChannelIcon } from "@/components/channel-icon";
import type { TextResult, TextVariant } from "@/lib/ai/types";
import { getPlatform, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

function Shimmer() {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface-2 p-4">
      <div
        aria-hidden
        className="absolute inset-y-0 -inset-x-full animate-sweep"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent, var(--surface-3), transparent)",
        }}
      />
      <div className="flex flex-col gap-2">
        <span className="h-3 w-3/4 rounded-full bg-surface-3" />
        <span className="h-3 w-full rounded-full bg-surface-3" />
        <span className="h-3 w-2/5 rounded-full bg-surface-3" />
      </div>
    </div>
  );
}

export function CaptionResults({
  result,
  loading,
  pendingCount,
  platform,
  error,
  onSend,
}: {
  result: TextResult | null;
  loading: boolean;
  pendingCount: number;
  platform: PlatformId | null;
  error: string | null;
  onSend: (variant: TextVariant) => void;
}) {
  const [copied, setCopied] = useState<number | null>(null);
  const variants = result?.variants ?? [];
  const limit = platform ? getPlatform(platform).captionLimit : null;

  const copy = async (variant: TextVariant, index: number) => {
    try {
      await navigator.clipboard.writeText(variant.text);
      setCopied(index);
      setTimeout(() => setCopied((current) => (current === index ? null : current)), 1_600);
    } catch {
      // Clipboard is blocked outside a secure context; the text stays selectable.
    }
  };

  return (
    <Card className="flex min-h-[520px] flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">Caption options</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {result
              ? `${variants.length} option${variants.length === 1 ? "" : "s"} · ${result.model.label} · ${(result.elapsedMs / 1000).toFixed(1)}s`
              : "Every option is written against the network's own limits"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result?.simulated ? <Badge tone="warn">Simulated</Badge> : null}
          {platform ? (
            <span className="inline-flex items-center gap-2 font-mono text-[11px] text-subtle tabular">
              <ChannelIcon platform={platform} size="sm" />
              {limit?.toLocaleString()} char limit
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 border-b border-danger-soft bg-danger-soft px-5 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-[13px] text-danger">{error}</p>
        </div>
      ) : null}

      <div className="flex-1 p-5">
        {loading && variants.length === 0 ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: Math.max(1, pendingCount) }, (_, index) => (
              <Shimmer key={index} />
            ))}
          </div>
        ) : variants.length === 0 ? (
          <div className="grid-field grid h-full min-h-[380px] place-items-center rounded-card border border-dashed border-line">
            <div className="max-w-xs text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full border border-signal-line bg-signal-soft">
                <PencilLine className="size-5 text-signal" />
              </span>
              <p className="mt-3 text-[14px] font-medium">No copy yet</p>
              <p className="mt-1 text-[13px] text-muted">
                Describe the post and pick a network — each option is capped to
                that network&apos;s caption and hashtag rules.
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {variants.map((variant, index) => {
              const over = limit !== null && variant.characters > limit;
              return (
                <li
                  key={`${index}-${variant.characters}`}
                  className="animate-rise rounded-card border border-line bg-surface-2 p-4"
                >
                  <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">
                    {variant.text}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                    <span
                      className={cn(
                        "font-mono text-[11px] tabular",
                        over ? "text-danger" : "text-subtle",
                      )}
                    >
                      {variant.characters.toLocaleString()}
                      {limit ? ` / ${limit.toLocaleString()}` : ""} chars
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void copy(variant, index)}
                      >
                        {copied === index ? <Check /> : <Copy />}
                        {copied === index ? "Copied" : "Copy"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onSend(variant)}
                      >
                        <SendHorizontal />
                        Composer
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
