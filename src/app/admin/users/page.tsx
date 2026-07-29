import { Suspense } from "react";
import type { Metadata } from "next";
import { DemoNotice } from "@/components/admin/demo-notice";
import { AdminFilters } from "@/components/admin/filters";
import { formatCount } from "@/components/admin/format";
import { MetricGrid, MetricTile } from "@/components/admin/metric-tile";
import {
  EmptyState,
  Pagination,
  Panel,
  TableSkeleton,
} from "@/components/admin/table";
import { UsersTable } from "@/components/admin/users-table";
import { requireAdmin } from "@/lib/auth";
import {
  listUsers,
  parseSubscriptionStatus,
  parseTier,
  SUBSCRIPTION_STATUSES,
  TIER_ORDER,
} from "@/lib/admin-data";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 25;

const TIER_OPTIONS = [
  { value: "all", label: "All plans" },
  ...TIER_ORDER.map((tier) => ({
    value: tier,
    label: tier.charAt(0).toUpperCase() + tier.slice(1),
  })),
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...SUBSCRIPTION_STATUSES.map((status) => ({
    value: status,
    label: status.replace("_", " ").replace(/^./, (c) => c.toUpperCase()),
  })),
];

interface Filters {
  q: string;
  tier: string;
  status: string;
  page: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const query = await searchParams;
  const filters: Filters = {
    q: first(query.q) ?? "",
    tier: parseTier(first(query.tier)),
    status: parseSubscriptionStatus(first(query.status)),
    page: first(query.page) ?? "1",
  };

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
      <DemoNotice />

      <div>
        <h1 className="font-display text-[21px] font-bold">Users</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Every account on the platform, with the plan and usage attached to it.
        </p>
      </div>

      <AdminFilters
        basePath="/admin/users"
        params={{ ...filters }}
        search={{ key: "q", placeholder: "Search name or email" }}
        selects={[
          { key: "tier", label: "Plan", options: TIER_OPTIONS },
          { key: "status", label: "Status", options: STATUS_OPTIONS },
        ]}
      />

      {/* Keyed so a filter change re-suspends and shows the skeleton again. */}
      <Suspense
        key={`${filters.q}|${filters.tier}|${filters.status}|${filters.page}`}
        fallback={
          <Panel title="Accounts" description="Loading…">
            <TableSkeleton rows={10} columns={7} />
          </Panel>
        }
      >
        <UsersSection filters={filters} />
      </Suspense>
    </div>
  );
}

async function UsersSection({ filters }: { filters: Filters }) {
  const result = await listUsers({
    query: filters.q,
    tier: parseTier(filters.tier),
    status: parseSubscriptionStatus(filters.status),
    page: Number.parseInt(filters.page, 10) || 1,
    pageSize: PAGE_SIZE,
  });

  const totals = result.rows.reduce(
    (acc, row) => ({
      workspaces: acc.workspaces + row.workspaces,
      posts: acc.posts + row.posts,
      aiImages: acc.aiImages + row.aiImages,
    }),
    { workspaces: 0, posts: 0, aiImages: 0 },
  );

  return (
    <>
      <MetricGrid>
        <MetricTile
          label="Matching accounts"
          value={formatCount(result.total)}
          sub={`Page ${result.page} of ${result.pageCount}`}
        />
        <MetricTile
          label="Workspaces on page"
          value={formatCount(totals.workspaces)}
          sub="Owned or joined"
        />
        <MetricTile
          label="Posts on page"
          value={formatCount(totals.posts)}
          sub="Lifetime published"
        />
        <MetricTile
          label="AI images on page"
          value={formatCount(totals.aiImages)}
          sub="Lifetime generated"
        />
      </MetricGrid>

      <Panel
        title="Accounts"
        description={`${formatCount(result.total)} matching this filter`}
      >
        {result.rows.length === 0 ? (
          <EmptyState
            title="No accounts match"
            description="Nothing here fits the current search and filters. Widen the plan or status filter, or clear the search box."
          />
        ) : (
          <>
            <UsersTable rows={result.rows} />
            <Pagination
              basePath="/admin/users"
              params={{
                q: filters.q,
                tier: filters.tier,
                status: filters.status,
              }}
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              pageSize={result.pageSize}
              noun="accounts"
            />
          </>
        )}
      </Panel>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
