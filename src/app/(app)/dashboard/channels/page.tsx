import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, Info, Plus, RefreshCw } from "lucide-react";
import { ChannelIcon } from "@/components/channel-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { PLATFORM_LIST, type PlatformId } from "@/lib/platforms";
import { isPublishable } from "@/lib/publish/registry";
import { supabaseServer } from "@/lib/supabase/server";
import { getPrimaryWorkspaceId } from "@/lib/workspace";

export const metadata: Metadata = { title: "Channels" };

// Connection state is per-user and changes on connect, so never cache it.
export const dynamic = "force-dynamic";

interface AccountRow {
  id: string;
  platform: PlatformId;
  handle: string;
  display_name: string | null;
  status: string;
}

async function loadAccounts(workspaceId: string): Promise<AccountRow[]> {
  try {
    const client = (await supabaseServer()) as unknown as SupabaseClient;
    const { data } = await client
      .from("social_accounts")
      .select("id, platform, handle, display_name, status")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
    return (data as AccountRow[] | null) ?? [];
  } catch {
    return [];
  }
}

function connectHref(platform: PlatformId, workspaceId: string): string {
  return `/api/oauth/${platform}/authorize?workspace=${workspaceId}`;
}

export default async function ChannelsPage() {
  const configured = isSupabaseConfigured();
  const workspaceId = configured ? await getPrimaryWorkspaceId() : null;
  const accounts = workspaceId ? await loadAccounts(workspaceId) : [];

  const connected = new Set(accounts.map((a) => a.platform));
  const needsAttention = accounts.filter(
    (a) => a.status === "expired" || a.status === "error",
  );

  // Split the catalogue into what we can publish to and what's still on the way.
  const available = PLATFORM_LIST.filter(
    (p) => !connected.has(p.id) && isPublishable(p.id),
  );
  const comingSoon = PLATFORM_LIST.filter((p) => !isPublishable(p.id));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold">Channels</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {accounts.length} connected · {available.length} available to connect
          </p>
        </div>
      </div>

      {!workspaceId ? (
        <Card className="flex items-start gap-3 border-signal-line bg-signal-soft p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-signal" />
          <p className="text-[13px] text-muted">
            {configured
              ? "Setting up your workspace — refresh in a moment to connect channels."
              : "Connect Socialexie to a Supabase project to link real channels."}
          </p>
        </Card>
      ) : null}

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
        </Card>
      ) : null}

      {accounts.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold">Connected</h2>
          </div>
          <ul className="divide-y divide-line">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center gap-4 px-5 py-4"
              >
                <ChannelIcon platform={account.platform} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {account.handle || account.display_name || account.platform}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] text-subtle capitalize tabular">
                    {account.platform}
                  </p>
                </div>

                {account.status === "active" ? (
                  <Badge tone="ok">Active</Badge>
                ) : (
                  <Badge tone="danger">Reconnect needed</Badge>
                )}

                {workspaceId ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={connectHref(account.platform, workspaceId)}>
                      <RefreshCw />
                      Reconnect
                    </Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">
          {accounts.length > 0 ? "Add another network" : "Connect a network"}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Every connection uses the network&apos;s official API. Socialexie never
          asks for your password.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((p) =>
            workspaceId ? (
              <Link
                key={p.id}
                href={connectHref(p.id, workspaceId)}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-left transition-colors hover:border-signal hover:bg-surface-3"
              >
                <ChannelIcon platform={p.id} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    {p.name}
                  </span>
                  <span className="block text-[11.5px] text-subtle">Connect</span>
                </span>
                <Plus className="size-4 shrink-0 text-subtle" />
              </Link>
            ) : (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3 opacity-60"
              >
                <ChannelIcon platform={p.id} />
                <span className="block truncate text-[13.5px] font-medium">
                  {p.name}
                </span>
              </div>
            ),
          )}
        </div>

        {comingSoon.length > 0 ? (
          <p className="mt-4 text-[12px] text-subtle">
            Coming soon: {comingSoon.map((p) => p.name).join(", ")}.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
