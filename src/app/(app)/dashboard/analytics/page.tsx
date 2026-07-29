import type { Metadata } from "next";
import { Bookmark, Eye, MessageCircle, Share2, TrendingUp } from "lucide-react";
import { AreaSpark, ShareBar } from "@/components/app/chart";
import { ChannelIcon, ChannelStack } from "@/components/channel-icon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { demoChannels, demoPosts, demoReachSeries } from "@/lib/demo";
import { compactNumber } from "@/lib/utils";
import type { PlatformId } from "@/lib/platforms";

export const metadata: Metadata = { title: "Analytics" };

/** Deterministic sample performance, derived from the demo posts. */
const TOP_POSTS = demoPosts.slice(0, 5).map((post, i) => ({
  id: post.id,
  title: post.title,
  channels: post.channels as PlatformId[],
  reach: 184_000 - i * 27_400,
  shares: 4_820 - i * 690,
  saves: 3_140 - i * 420,
  comments: 912 - i * 118,
}));

const SIGNALS = [
  {
    icon: Share2,
    label: "Shares",
    value: 18_420,
    delta: "+41%",
    note: "The strongest driver of reach beyond your followers.",
    tone: "live" as const,
  },
  {
    icon: Bookmark,
    label: "Saves",
    value: 11_260,
    delta: "+26%",
    note: "Signals lasting value. Lists and how-tos earn these.",
    tone: "ok" as const,
  },
  {
    icon: MessageCircle,
    label: "Comments",
    value: 6_840,
    delta: "+12%",
    note: "Deepens the audience you already have.",
    tone: "info" as const,
  },
  {
    icon: Eye,
    label: "Reach",
    value: 1_248_000,
    delta: "+38%",
    note: "People who saw a post, followers and strangers combined.",
    tone: "signal" as const,
  },
];

export default function AnalyticsPage() {
  const totalFollowers = demoChannels.reduce((n, c) => n + c.followers, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="font-display text-[26px] font-bold">Analytics</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-muted">
          Ordered by what actually moves distribution. Likes are counted, but
          they sit last on purpose — shares, saves and watch time are what push
          a post past your own followers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SIGNALS.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center gap-2">
              <s.icon className="size-4 text-subtle" />
              <span className="text-[11px] tracking-[0.1em] text-subtle uppercase">
                {s.label}
              </span>
              <Badge tone={s.tone} className="ml-auto">
                {s.delta}
              </Badge>
            </div>
            <p className="mt-3 font-display text-[26px] leading-none font-extrabold tabular">
              {compactNumber(s.value)}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-subtle">
              {s.note}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold">Reach trend</h2>
              <p className="mt-1 text-[13px] text-muted">Last 7 days</p>
            </div>
            <Badge tone="ok">
              <TrendingUp className="size-3" />
              +38%
            </Badge>
          </div>
          <div className="mt-6">
            <AreaSpark
              values={demoReachSeries}
              height={140}
              label="Reach over the last seven days"
            />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Audience by channel</h2>
          <p className="mt-1 text-[13px] text-muted">
            {compactNumber(totalFollowers)} followers in total
          </p>
          <ul className="mt-5 flex flex-col gap-3.5">
            {demoChannels.map((ch) => (
              <li key={ch.id}>
                <div className="flex items-center gap-2">
                  <ChannelIcon platform={ch.platform} size="sm" />
                  <span className="flex-1 truncate text-[13px]">
                    {ch.handle}
                  </span>
                  <span className="font-mono text-[12px] text-muted tabular">
                    {compactNumber(ch.followers)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <ShareBar
                    value={ch.followers}
                    total={totalFollowers}
                    color="var(--signal)"
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold">Top posts</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Ranked by shares, not by likes
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[11px] tracking-wide text-subtle uppercase">
                <th className="px-5 py-2.5 text-left font-semibold">Post</th>
                <th className="px-3 py-2.5 text-left font-semibold">Channels</th>
                <th className="px-3 py-2.5 text-right font-semibold">Reach</th>
                <th className="px-3 py-2.5 text-right font-semibold">Shares</th>
                <th className="px-3 py-2.5 text-right font-semibold">Saves</th>
                <th className="px-5 py-2.5 text-right font-semibold">Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {TOP_POSTS.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-surface-2">
                  <td className="max-w-[280px] truncate px-5 py-3">{p.title}</td>
                  <td className="px-3 py-3">
                    <ChannelStack platforms={p.channels} />
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular">
                    {compactNumber(p.reach)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-live tabular">
                    {compactNumber(p.shares)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular">
                    {compactNumber(p.saves)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular">
                    {compactNumber(p.comments)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
