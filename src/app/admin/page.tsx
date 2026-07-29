import type { Metadata } from "next";
import { AreaSpark, ShareBar } from "@/components/app/chart";
import { DemoNotice } from "@/components/admin/demo-notice";
import { formatCount, formatDate } from "@/components/admin/format";
import { MetricGrid, MetricTile } from "@/components/admin/metric-tile";
import { PeriodFilter } from "@/components/admin/period-filter";
import {
  EmptyState,
  Panel,
  SortHeader,
  Table,
  TableScroll,
  TD,
  TH,
  TRow,
} from "@/components/admin/table";
import { requireAdmin } from "@/lib/auth";
import {
  getPlatformOverview,
  parsePeriod,
  PERIOD_LABEL,
  type OverviewPeriod,
  type TopWorkspaceRow,
} from "@/lib/admin-data";
import { compactNumber, formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

type SortField = "name" | "posts" | "aiImages" | "lastActive" | "joined";

const SORT_FIELDS: readonly SortField[] = [
  "name",
  "posts",
  "aiImages",
  "lastActive",
  "joined",
];

function sortWorkspaces(
  rows: readonly TopWorkspaceRow[],
  field: SortField,
  direction: "asc" | "desc",
): TopWorkspaceRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (field) {
      case "name":
        return sign * a.name.localeCompare(b.name);
      case "posts":
        return sign * (a.posts - b.posts);
      case "aiImages":
        return sign * (a.aiImages - b.aiImages);
      case "lastActive":
        return sign * ((a.lastActive ?? "").localeCompare(b.lastActive ?? ""));
      case "joined":
        return sign * a.joined.localeCompare(b.joined);
    }
  });
}

function sortHref(
  period: OverviewPeriod,
  field: SortField,
  active: boolean,
  direction: "asc" | "desc",
): string {
  const params = new URLSearchParams();
  if (period !== "lifetime") params.set("period", period);
  params.set("sort", field);
  params.set("dir", active && direction === "desc" ? "asc" : "desc");
  return `/admin?${params.toString()}`;
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const query = await searchParams;
  const period = parsePeriod(first(query.period));
  const sort = (SORT_FIELDS as readonly string[]).includes(first(query.sort) ?? "")
    ? (first(query.sort) as SortField)
    : "posts";
  const direction = first(query.dir) === "asc" ? "asc" : "desc";

  const overview = await getPlatformOverview(period);
  const { totals, growth, planMix, topWorkspaces } = overview;
  const windowLabel = PERIOD_LABEL[period].toLowerCase();
  const planTotal = planMix.reduce((n, row) => n + row.total, 0);
  const rows = sortWorkspaces(topWorkspaces, sort, direction);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
      <DemoNotice />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[21px] font-bold">Platform overview</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Every workspace, every tenant, {windowLabel}.
          </p>
        </div>
        <PeriodFilter value={period} />
      </div>

      <MetricGrid>
        <MetricTile
          label="Total users"
          value={formatCount(totals.users)}
          sub={`${formatCount(totals.newUsers)} joined ${windowLabel}`}
        />
        <MetricTile
          label="Active users"
          value={formatCount(totals.activeUsers)}
          sub={`Recorded output ${windowLabel}`}
          tone="live"
        />
        <MetricTile
          label="Workspaces"
          value={formatCount(totals.workspaces)}
          sub="Brands across all accounts"
        />
        <MetricTile
          label="Connected channels"
          value={formatCount(totals.channels)}
          sub="Accounts with a live token"
        />
        <MetricTile
          label="Posts published"
          value={compactNumber(totals.postsPublished)}
          sub={`Across every network, ${windowLabel}`}
        />
        <MetricTile
          label="AI images"
          value={compactNumber(totals.aiImages)}
          sub={`Generated ${windowLabel}`}
        />
        <MetricTile
          label="MRR"
          value={formatPrice(totals.mrrCents)}
          sub="Recurring subscriptions only"
          tone="signal"
        />
        <MetricTile
          label="Lifetime revenue"
          value={formatPrice(totals.lifetimeRevenueCents)}
          sub="One-time licences booked"
          tone="signal"
        />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          title="User growth"
          description={`Cumulative signups, ${windowLabel}`}
        >
          <div className="p-4">
            <AreaSpark
              values={growth.map((point) => point.value)}
              height={132}
              label={`Cumulative signups, ${windowLabel}`}
            />
            <div className="mt-2 flex justify-between font-mono text-[11px] text-subtle tabular">
              <span>{growth[0]?.label}</span>
              <span>
                {growth[growth.length - 1]?.label} ·{" "}
                {formatCount(growth[growth.length - 1]?.value ?? 0)} accounts
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="Plan mix" description={`${formatCount(planTotal)} paying and free seats`}>
          <ul className="flex flex-col gap-3 p-4">
            {planMix.map((row) => (
              <li key={row.tier}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2 text-[12.5px]">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.label}
                  </span>
                  <span className="font-mono text-[11.5px] text-muted tabular">
                    {formatCount(row.total)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <ShareBar value={row.total} total={planTotal} color={row.color} />
                </div>
                <p className="mt-1 font-mono text-[10.5px] text-subtle tabular">
                  {formatCount(row.monthly)} monthly · {formatCount(row.lifetime)}{" "}
                  lifetime
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Top workspaces by output"
        description={`Ranked on posts and AI images, ${windowLabel}`}
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No recorded output"
            description="No workspace logged a published post or a generated image in this window."
          />
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <SortHeader
                    label="Workspace"
                    field="name"
                    active={sort === "name"}
                    direction={direction}
                    href={sortHref(period, "name", sort === "name", direction)}
                  />
                  <TH>Owner</TH>
                  <SortHeader
                    label="Posts"
                    field="posts"
                    numeric
                    active={sort === "posts"}
                    direction={direction}
                    href={sortHref(period, "posts", sort === "posts", direction)}
                  />
                  <SortHeader
                    label="AI images"
                    field="aiImages"
                    numeric
                    active={sort === "aiImages"}
                    direction={direction}
                    href={sortHref(period, "aiImages", sort === "aiImages", direction)}
                  />
                  <SortHeader
                    label="Last active"
                    field="lastActive"
                    numeric
                    active={sort === "lastActive"}
                    direction={direction}
                    href={sortHref(
                      period,
                      "lastActive",
                      sort === "lastActive",
                      direction,
                    )}
                  />
                  <SortHeader
                    label="Joined"
                    field="joined"
                    numeric
                    active={sort === "joined"}
                    direction={direction}
                    href={sortHref(period, "joined", sort === "joined", direction)}
                  />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <TRow key={row.id}>
                    <TD>
                      <p className="font-medium">{row.name}</p>
                      <p className="font-mono text-[11px] text-subtle">/{row.slug}</p>
                    </TD>
                    <TD className="font-mono text-[12px] text-muted">
                      {row.ownerEmail}
                    </TD>
                    <TD numeric>{formatCount(row.posts)}</TD>
                    <TD numeric>{formatCount(row.aiImages)}</TD>
                    <TD numeric className="text-muted">
                      {formatDate(row.lastActive)}
                    </TD>
                    <TD numeric className="text-muted">
                      {formatDate(row.joined)}
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Panel>
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
