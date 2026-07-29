import type { Metadata } from "next";
import { Image as ImageIcon, Video } from "lucide-react";
import { ShareBar } from "@/components/app/chart";
import { DemoNotice } from "@/components/admin/demo-notice";
import { formatBytes, formatCount, formatDate } from "@/components/admin/format";
import { MetricGrid, MetricTile } from "@/components/admin/metric-tile";
import {
  EmptyState,
  Panel,
  Table,
  TableScroll,
  TD,
  TH,
  TRow,
} from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { getAssetStats } from "@/lib/admin-data";
import { compactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Assets" };

const KIND_COLOR: Record<string, string> = {
  image: "#63a4ff",
  video: "#9b6dff",
};

const PROVIDER_COLOR = ["#ffb020", "#23c8ae", "#63a4ff", "#9b6dff", "#e1306c"];

export default async function AdminAssetsPage() {
  await requireAdmin();

  const stats = await getAssetStats();
  const kindTotal = stats.byKind.reduce((n, bucket) => n + bucket.bytes, 0);
  const providerTotal = stats.byProvider.reduce((n, bucket) => n + bucket.count, 0);
  const largestBytes = stats.topWorkspaces[0]?.bytes ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
      <DemoNotice />

      <div>
        <h1 className="font-display text-[21px] font-bold">Assets & storage</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Everything in the media library across every tenant.
          {stats.sampled
            ? " Breakdowns are computed from the most recent 5,000 uploads."
            : ""}
        </p>
      </div>

      <MetricGrid>
        <MetricTile
          label="Total assets"
          value={compactNumber(stats.totalAssets)}
          sub={`${formatCount(stats.totalAssets)} rows in the library`}
        />
        <MetricTile
          label="Stored"
          value={formatBytes(stats.totalBytes)}
          sub={stats.sampled ? "Sampled from recent uploads" : "Sum of every object"}
          tone="signal"
        />
        <MetricTile
          label="Images"
          value={compactNumber(stats.imageCount)}
          sub={`${formatCount(stats.aiCount)} came from the AI studio`}
        />
        <MetricTile
          label="Video"
          value={compactNumber(stats.videoCount)}
          sub="Reels, shorts and long-form"
          tone="live"
        />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By kind" description="Where the bytes actually go">
          {stats.byKind.length === 0 ? (
            <EmptyState
              title="Nothing stored yet"
              description="No workspace has uploaded or generated a media asset."
            />
          ) : (
            <ul className="flex flex-col gap-3.5 p-4">
              {stats.byKind.map((bucket) => (
                <li key={bucket.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-[12.5px]">
                      {bucket.key === "video" ? (
                        <Video className="size-3.5 text-subtle" />
                      ) : (
                        <ImageIcon className="size-3.5 text-subtle" />
                      )}
                      {bucket.label}
                      <span className="text-[11px] text-subtle">
                        {formatCount(bucket.count)} files
                      </span>
                    </span>
                    <span className="font-mono text-[12px] text-muted tabular">
                      {formatBytes(bucket.bytes)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ShareBar
                      value={bucket.bytes}
                      total={kindTotal}
                      color={KIND_COLOR[bucket.key] ?? "#6d7580"}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="By AI provider"
          description="Generated assets only, counted by the model that made them"
        >
          {stats.byProvider.length === 0 ? (
            <EmptyState
              title="No generated assets"
              description="Nothing in the library carries a provider, so every file was uploaded by hand."
            />
          ) : (
            <ul className="flex flex-col gap-3.5 p-4">
              {stats.byProvider.map((bucket, index) => (
                <li key={bucket.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] lowercase">{bucket.label}</span>
                    <span className="font-mono text-[12px] text-muted tabular">
                      {formatCount(bucket.count)} · {formatBytes(bucket.bytes)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ShareBar
                      value={bucket.count}
                      total={providerTotal}
                      color={PROVIDER_COLOR[index % PROVIDER_COLOR.length]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Largest workspaces by storage"
        description="Where a quota conversation is likely to start"
      >
        {stats.topWorkspaces.length === 0 ? (
          <EmptyState
            title="No workspaces with assets"
            description="Storage attribution appears once a workspace uploads its first file."
          />
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <TH>Workspace</TH>
                  <TH numeric>Assets</TH>
                  <TH numeric>Stored</TH>
                  <TH className="w-[38%]">Share</TH>
                </tr>
              </thead>
              <tbody>
                {stats.topWorkspaces.map((row) => (
                  <TRow key={row.id}>
                    <TD className="font-medium">{row.name}</TD>
                    <TD numeric>{formatCount(row.assets)}</TD>
                    <TD numeric>{formatBytes(row.bytes)}</TD>
                    <TD>
                      <ShareBar
                        value={row.bytes}
                        total={largestBytes}
                        color="var(--signal)"
                      />
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Panel>

      <Panel title="Recent uploads" description="Newest objects across the platform">
        {stats.recentUploads.length === 0 ? (
          <EmptyState
            title="Nothing uploaded yet"
            description="New files appear here the moment a workspace saves one."
          />
        ) : (
          <ul className="divide-y divide-line">
            {stats.recentUploads.map((upload) => (
              <li
                key={upload.id}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-subtle">
                  {upload.kind === "video" ? (
                    <Video className="size-3.5" />
                  ) : (
                    <ImageIcon className="size-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[12px]">{upload.path}</p>
                  <p className="truncate text-[11px] text-subtle">
                    {upload.workspace}
                  </p>
                </div>
                {upload.provider ? (
                  <Badge tone="signal" className="hidden lowercase sm:inline-flex">
                    {upload.provider}
                  </Badge>
                ) : null}
                <span className="font-mono text-[11.5px] text-muted tabular">
                  {formatBytes(upload.bytes)}
                </span>
                <span className="hidden font-mono text-[11.5px] text-subtle tabular sm:inline">
                  {formatDate(upload.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
