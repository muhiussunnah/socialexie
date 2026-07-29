import type { Metadata } from "next";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { ChannelIcon } from "@/components/channel-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { demoChannels } from "@/lib/demo";
import { PLATFORM_LIST } from "@/lib/platforms";
import { compactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Channels" };

export default function ChannelsPage() {
  const connectedPlatforms = new Set(demoChannels.map((c) => c.platform));
  const available = PLATFORM_LIST.filter((p) => !connectedPlatforms.has(p.id));
  const needsAttention = demoChannels.filter((c) => c.status === "expired");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold">Channels</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {demoChannels.length} connected · {available.length} available
          </p>
        </div>
        <Button size="sm">
          <Plus />
          Connect a channel
        </Button>
      </div>

      {needsAttention.length > 0 ? (
        <Card className="flex items-start gap-3 border-danger-soft bg-danger-soft p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">
              {needsAttention.length} channel
              {needsAttention.length > 1 ? "s need" : " needs"} reconnecting
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Access tokens expire periodically. Anything queued for these
              channels stays in the queue and goes out once you reconnect —
              nothing is lost.
            </p>
          </div>
          <Button size="sm" variant="secondary">
            <RefreshCw />
            Reconnect
          </Button>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold">Connected</h2>
        </div>
        <ul className="divide-y divide-line">
          {demoChannels.map((ch) => (
            <li key={ch.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <ChannelIcon platform={ch.platform} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{ch.handle}</p>
                <p className="mt-0.5 font-mono text-[12px] text-subtle tabular">
                  {compactNumber(ch.followers)} followers
                </p>
              </div>

              <div className="text-right">
                <p className="font-mono text-[13px] text-ok tabular">
                  +{ch.growth7d}%
                </p>
                <p className="text-[11px] text-subtle">7 days</p>
              </div>

              {ch.status === "expired" ? (
                <Badge tone="danger">Token expired</Badge>
              ) : (
                <Badge tone="ok">Active</Badge>
              )}

              <Button variant="ghost" size="sm">
                Manage
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Add another network</h2>
        <p className="mt-1 text-[13px] text-muted">
          Every connection uses the network&apos;s official API. Socialexie
          never asks for your password.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-left transition-colors hover:border-signal hover:bg-surface-3"
            >
              <ChannelIcon platform={p.id} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">
                  {p.name}
                </span>
                <span className="block text-[11.5px] text-subtle">
                  {p.formats.length} formats
                </span>
              </span>
              <Plus className="size-4 shrink-0 text-subtle" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
