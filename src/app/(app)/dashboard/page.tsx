import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { AreaSpark, ShareBar } from "@/components/app/chart";
import { ChannelIcon, ChannelStack } from "@/components/channel-icon";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  demoCategories,
  demoChannels,
  demoMetrics,
  demoPosts,
  demoReachSeries,
  demoWorkspace,
} from "@/lib/demo";
import { compactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

const STATUS_TONE = {
  published: "ok",
  scheduled: "neutral",
  recycling: "info",
  draft: "warn",
  failed: "danger",
} as const;

export default function DashboardPage() {
  const totalCategoryPosts = demoCategories.reduce((n, c) => n + c.count, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold">Overview</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {demoWorkspace.name} · {demoWorkspace.timezone}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted">
          <LiveDot />
          Publisher running · next in 12m
        </span>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Scheduled", value: compactNumber(demoMetrics.scheduled), sub: "posts in queue" },
          { label: "Published", value: String(demoMetrics.publishedThisWeek), sub: "this week" },
          { label: "Reach", value: compactNumber(demoMetrics.reach30d), sub: "last 30 days" },
          { label: "Shares", value: compactNumber(demoMetrics.shares30d), sub: "last 30 days" },
        ].map((m) => (
          <Card key={m.label} className="p-4">
            <p className="text-[11px] tracking-[0.1em] text-subtle uppercase">
              {m.label}
            </p>
            <p className="mt-2 font-display text-[28px] leading-none font-extrabold tabular">
              {m.value}
            </p>
            <p className="mt-1.5 text-[12px] text-subtle">{m.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Reach trend */}
        <Card className="flex flex-col p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold">Reach</h2>
              <p className="mt-1 text-[13px] text-muted">
                Last 7 days across every connected channel
              </p>
            </div>
            <Badge tone="ok">
              <TrendingUp className="size-3" />
              +38%
            </Badge>
          </div>
          <div className="mt-6">
            <AreaSpark
              values={demoReachSeries}
              height={110}
              label="Reach over the last seven days"
            />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-subtle tabular">
            <span>7d ago</span>
            <span>{compactNumber(demoReachSeries[demoReachSeries.length - 1])} today</span>
          </div>
        </Card>

        {/* Categories */}
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Content mix</h2>
          <p className="mt-1 text-[13px] text-muted">
            {totalCategoryPosts} posts in the library
          </p>
          <ul className="mt-5 flex flex-col gap-3.5">
            {demoCategories.map((c) => (
              <li key={c.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2 text-[13px]">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                    {c.recycle ? (
                      <span className="text-[10px] text-subtle">recycling</span>
                    ) : null}
                  </span>
                  <span className="font-mono text-[12px] text-muted tabular">
                    {c.count}
                  </span>
                </div>
                <div className="mt-1.5">
                  <ShareBar value={c.count} total={totalCategoryPosts} color={c.color} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Queue */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold">Up next</h2>
              <p className="mt-0.5 text-[13px] text-muted">
                The queue for the next 48 hours
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/calendar">
                Calendar <ArrowUpRight />
              </Link>
            </Button>
          </div>

          <ul className="divide-y divide-line">
            {demoPosts.map((post) => (
              <li
                key={post.id}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
              >
                <div className="w-16 shrink-0">
                  <p className="font-mono text-[12px] font-medium tabular">
                    {post.time}
                  </p>
                  <p className="text-[11px] text-subtle">{post.day}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px]">{post.title}</p>
                  <p className="mt-0.5 text-[11px] text-subtle">{post.category}</p>
                </div>
                <ChannelStack
                  platforms={post.channels}
                  className="hidden sm:inline-flex"
                />
                <Badge tone={STATUS_TONE[post.status]} className="capitalize">
                  {post.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        {/* Channels */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold">Channels</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/channels">Manage</Link>
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {demoChannels.map((ch) => (
              <li key={ch.id} className="flex items-center gap-3 px-5 py-3">
                <ChannelIcon platform={ch.platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{ch.handle}</p>
                  <p className="font-mono text-[11px] text-subtle tabular">
                    {compactNumber(ch.followers)} followers
                  </p>
                </div>
                {ch.status === "expired" ? (
                  <Badge tone="danger">Reconnect</Badge>
                ) : (
                  <span className="font-mono text-[12px] text-ok tabular">
                    +{ch.growth7d}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
