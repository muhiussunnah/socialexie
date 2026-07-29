import type { Metadata } from "next";
import { AlertTriangle, Copy, Plus } from "lucide-react";
import { ChannelIcon } from "@/components/channel-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShareBar } from "@/components/app/chart";
import { demoCategories } from "@/lib/demo";
import { GOAL_LABEL, TEMPLATES, type Goal } from "@/lib/templates";

export const metadata: Metadata = { title: "Library" };

const GOAL_TONE: Record<Goal, "signal" | "live" | "info" | "ok" | "warn"> = {
  comments: "info",
  shares: "live",
  saves: "ok",
  reach: "signal",
  leads: "warn",
};

export default function LibraryPage() {
  const totalPosts = demoCategories.reduce((n, c) => n + c.count, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold">Library</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {totalPosts} posts across {demoCategories.length} categories
          </p>
        </div>
        <Button size="sm">
          <Plus />
          New category
        </Button>
      </div>

      {/* Categories drive the recycling engine, so they lead the page. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {demoCategories.map((c) => (
          <Card key={c.name} className="p-5">
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              <h2 className="text-[15px] font-semibold">{c.name}</h2>
              {c.recycle ? (
                <Badge tone="info" className="ml-auto">
                  Recycling
                </Badge>
              ) : (
                <Badge className="ml-auto">Once</Badge>
              )}
            </div>
            <p className="mt-4 font-display text-[26px] leading-none font-extrabold tabular">
              {c.count}
            </p>
            <p className="mt-1 text-[12px] text-subtle">posts in this category</p>
            <div className="mt-4">
              <ShareBar value={c.count} total={totalPosts} color={c.color} />
            </div>
          </Card>
        ))}
      </div>

      {/* Template library */}
      <div className="mt-4">
        <h2 className="font-display text-[19px] font-bold">Post templates</h2>
        <p className="mt-1 max-w-2xl text-[13.5px] text-muted">
          Each template is labelled with the action it earns. Shares and saves
          push a post to people who don&apos;t follow you yet; comments deepen
          the audience you already have.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {TEMPLATES.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold">{t.name}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                    {t.rationale}
                  </p>
                </div>
                <Badge tone={GOAL_TONE[t.goal]}>{GOAL_LABEL[t.goal]}</Badge>
              </div>

              <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3.5">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-subtle uppercase">
                  Example
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed">{t.example}</p>
              </div>

              {t.caution ? (
                <div className="mt-3 flex gap-2.5 rounded-lg border border-warn-soft bg-warn-soft p-3">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />
                  <p className="text-[12.5px] leading-relaxed text-muted">
                    {t.caution}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                <span className="flex items-center gap-1">
                  {t.bestFor.map((p) => (
                    <ChannelIcon key={p} platform={p} size="sm" />
                  ))}
                </span>
                <Button variant="ghost" size="sm" className="ml-auto">
                  <Copy />
                  Use template
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
