"use client";

import {
  Download,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { GeneratedImage, ImageResult } from "@/lib/ai/types";
import { cn } from "@/lib/utils";
import { aspectLabel } from "@/components/studio/size-control";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function filenameFor(image: GeneratedImage, index: number): string {
  const extension = EXTENSIONS[image.mimeType] ?? "png";
  return `socialexie-${image.width}x${image.height}-${index + 1}.${extension}`;
}

function Shimmer({ ratio }: { ratio: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-card border border-line bg-surface-2"
      style={{ aspectRatio: ratio }}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 -inset-x-full animate-sweep"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent, var(--surface-3), transparent)",
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <Sparkles className="size-5 animate-pulse-live text-subtle" />
      </div>
    </div>
  );
}

export function ResultsGrid({
  result,
  loading,
  pendingCount,
  size,
  error,
  regeneratingIndex,
  onRegenerate,
  onSend,
}: {
  result: ImageResult | null;
  loading: boolean;
  pendingCount: number;
  size: { width: number; height: number };
  error: string | null;
  regeneratingIndex: number | null;
  onRegenerate: (index: number) => void;
  onSend: (image: GeneratedImage, index: number) => void;
}) {
  const ratio = `${size.width} / ${size.height}`;
  const images = result?.images ?? [];

  return (
    <Card className="flex min-h-[520px] flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">Results</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {result
              ? `${images.length} image${images.length === 1 ? "" : "s"} · ${result.model.label} · ${(result.elapsedMs / 1000).toFixed(1)}s`
              : "Renders land here as soon as they finish"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result?.simulated ? <Badge tone="warn">Simulated</Badge> : null}
          {result && !result.simulated && result.attempts.length > 0 ? (
            <Badge tone="info">
              Failed over from {result.attempts.length} provider
              {result.attempts.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
          {result ? (
            <span className="font-mono text-[11px] text-subtle tabular">
              {size.width}×{size.height} · {aspectLabel(size.width, size.height)}
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
        {loading && images.length === 0 ? (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {Array.from({ length: Math.max(1, pendingCount) }, (_, index) => (
              <Shimmer key={index} ratio={ratio} />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="grid-field grid h-full min-h-[380px] place-items-center rounded-card border border-dashed border-line">
            <div className="max-w-xs text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full border border-signal-line bg-signal-soft">
                <Sparkles className="size-5 text-signal" />
              </span>
              <p className="mt-3 text-[14px] font-medium">Nothing rendered yet</p>
              <p className="mt-1 text-[13px] text-muted">
                Describe the shot, pick a canvas, and the studio will route the
                job to the cheapest model you have wired up.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {images.map((image, index) => (
              <figure
                key={`${image.url.slice(-24)}-${index}`}
                className={cn(
                  "group relative animate-rise overflow-hidden rounded-card border border-line bg-surface-2",
                  regeneratingIndex === index && "opacity-60",
                )}
                style={{ aspectRatio: ratio }}
              >
                {/* Model output comes from a data URI or an arbitrary vendor
                    host, neither of which the image optimiser can serve. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={`Generated option ${index + 1}`}
                  loading="lazy"
                  className="size-full object-cover"
                />

                {regeneratingIndex === index ? (
                  <span className="absolute inset-0 grid place-items-center">
                    <RefreshCw className="size-5 animate-pulse-live text-invert" />
                  </span>
                ) : null}

                <figcaption
                  className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1.5 p-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                  style={{
                    backgroundImage:
                      "linear-gradient(to top, var(--overlay), transparent)",
                  }}
                >
                  <button
                    type="button"
                    title="Regenerate this frame"
                    aria-label={`Regenerate option ${index + 1}`}
                    onClick={() => onRegenerate(index)}
                    className="grid size-8 place-items-center rounded-lg border border-line bg-surface/90 text-muted backdrop-blur transition-colors hover:text-fg"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                  <a
                    href={image.url}
                    download={filenameFor(image, index)}
                    title="Download"
                    aria-label={`Download option ${index + 1}`}
                    className="grid size-8 place-items-center rounded-lg border border-line bg-surface/90 text-muted backdrop-blur transition-colors hover:text-fg"
                  >
                    <Download className="size-3.5" />
                  </a>
                  <button
                    type="button"
                    title="Send to composer"
                    aria-label={`Send option ${index + 1} to the composer`}
                    onClick={() => onSend(image, index)}
                    className="grid size-8 place-items-center rounded-lg bg-signal text-signal-fg transition-[filter] hover:brightness-108"
                  >
                    <SendHorizontal className="size-3.5" />
                  </button>
                </figcaption>
              </figure>
            ))}

            {loading
              ? Array.from({ length: Math.max(0, pendingCount) }, (_, index) => (
                  <Shimmer key={`pending-${index}`} ratio={ratio} />
                ))
              : null}
          </div>
        )}
      </div>
    </Card>
  );
}
