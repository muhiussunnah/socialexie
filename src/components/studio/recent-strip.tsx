"use client";

import { History, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface RecentEntry {
  id: string;
  kind: "image" | "caption";
  prompt: string;
  modelLabel: string;
  simulated: boolean;
  at: number;
  /** Image entries only. */
  url?: string;
  width?: number;
  height?: number;
  /** Caption entries only. */
  excerpt?: string;
}

function relativeTime(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function RecentStrip({
  entries,
  onReuse,
}: {
  entries: readonly RecentEntry[];
  onReuse: (entry: RecentEntry) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2">
          <History className="size-4 text-subtle" />
          <h2 className="text-[14px] font-semibold">Recent generations</h2>
        </div>
        <span className="font-mono text-[11px] text-subtle tabular">
          {entries.length} this session
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-muted">
          Everything you render this session collects here, so you can pull an
          earlier prompt back into the panel with one click.
        </p>
      ) : (
        <ul className="flex gap-3 overflow-x-auto px-5 py-4">
          {entries.map((entry) => (
            <li key={entry.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onReuse(entry)}
                title={entry.prompt}
                className={cn(
                  "flex w-[164px] flex-col gap-2 rounded-card border border-line bg-surface-2 p-2 text-left",
                  "transition-colors hover:border-line-strong hover:bg-surface-3",
                )}
              >
                {entry.kind === "image" && entry.url ? (
                  <span
                    className="block overflow-hidden rounded-lg border border-line bg-surface-3"
                    style={{
                      aspectRatio: `${entry.width ?? 1} / ${entry.height ?? 1}`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.url}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </span>
                ) : (
                  <span className="flex min-h-[92px] flex-col gap-1.5 rounded-lg border border-line bg-surface-3 p-2.5">
                    <Quote className="size-3.5 text-subtle" />
                    <span className="line-clamp-3 text-[11.5px] leading-snug text-muted">
                      {entry.excerpt}
                    </span>
                  </span>
                )}

                <span className="line-clamp-2 text-[11.5px] leading-snug text-fg">
                  {entry.prompt}
                </span>

                <span className="flex items-center justify-between gap-1.5">
                  <span className="truncate font-mono text-[10px] text-subtle">
                    {entry.modelLabel}
                  </span>
                  {entry.simulated ? (
                    <Badge tone="warn" className="px-1.5 py-0 text-[9.5px]">
                      sim
                    </Badge>
                  ) : (
                    <span className="font-mono text-[10px] text-subtle tabular">
                      {relativeTime(entry.at)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
