import type { Metadata } from "next";
import { DemoNotice } from "@/components/admin/demo-notice";
import { AdminFilters } from "@/components/admin/filters";
import { formatCount, formatDate } from "@/components/admin/format";
import { LicenseGenerator } from "@/components/admin/license-generator";
import { MetricGrid, MetricTile } from "@/components/admin/metric-tile";
import {
  EmptyState,
  Pagination,
  Panel,
  Table,
  TableScroll,
  TD,
  TH,
  TRow,
} from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import {
  listLicenses,
  parseLicenseStatus,
  parseTier,
  TIER_ORDER,
  type LicenseStatus,
} from "@/lib/admin-data";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Licenses" };

const PAGE_SIZE = 25;

const STATUS_TONE: Record<LicenseStatus, "ok" | "info" | "danger"> = {
  available: "info",
  redeemed: "ok",
  revoked: "danger",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "redeemed", label: "Redeemed" },
  { value: "revoked", label: "Revoked" },
];

const TIER_OPTIONS = [
  { value: "all", label: "All tiers" },
  ...TIER_ORDER.filter((tier) => tier !== "free").map((tier) => ({
    value: tier,
    label: tier.charAt(0).toUpperCase() + tier.slice(1),
  })),
];

/** Only the paid ladder can be sold as a one-time licence. */
const SELLABLE = PLANS.map((plan) => ({ value: plan.tier, label: plan.name }));

export default async function AdminLicensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const query = await searchParams;
  const status = parseLicenseStatus(first(query.status));
  const tier = parseTier(first(query.tier));
  const page = Number.parseInt(first(query.page) ?? "1", 10) || 1;

  const result = await listLicenses({ status, tier, page, pageSize: PAGE_SIZE });
  const issued =
    result.counts.available + result.counts.redeemed + result.counts.revoked;
  const redemptionRate =
    issued > 0 ? Math.round((result.counts.redeemed / issued) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
      <DemoNotice />

      <div>
        <h1 className="font-display text-[21px] font-bold">Licenses</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          One-time codes for the lifetime ladder. A redeemed code grants its tier
          permanently and never renews.
        </p>
      </div>

      <MetricGrid>
        <MetricTile
          label="Issued"
          value={formatCount(issued)}
          sub={`${redemptionRate}% redeemed`}
        />
        <MetricTile
          label="Available"
          value={formatCount(result.counts.available)}
          sub="Unclaimed and live"
        />
        <MetricTile
          label="Redeemed"
          value={formatCount(result.counts.redeemed)}
          sub={`${formatCount(result.seatsRedeemed)} seats granted`}
          tone="live"
        />
        <MetricTile
          label="Implied revenue"
          value={formatPrice(result.redeemedRevenueCents)}
          sub="Lifetime list price of redeemed codes"
          tone="signal"
        />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="flex flex-col gap-3">
          <AdminFilters
            basePath="/admin/licenses"
            params={{ status, tier, page: String(page) }}
            selects={[
              { key: "status", label: "Status", options: STATUS_OPTIONS },
              { key: "tier", label: "Tier", options: TIER_OPTIONS },
            ]}
          />

          <Panel
            title="Codes"
            description={`${formatCount(result.total)} matching this filter`}
          >
            {result.rows.length === 0 ? (
              <EmptyState
                title="No codes match"
                description="Generate a batch, or clear the status and tier filters to see the whole ledger."
              />
            ) : (
              <>
                <TableScroll>
                  <Table>
                    <thead>
                      <tr>
                        <TH>Code</TH>
                        <TH>Tier</TH>
                        <TH numeric>Seats</TH>
                        <TH>Redeemed by</TH>
                        <TH numeric>Redeemed</TH>
                        <TH>Status</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row) => (
                        <TRow key={row.id}>
                          <TD>
                            <p className="font-mono text-[12.5px] font-medium tabular">
                              {row.code}
                            </p>
                            {row.note ? (
                              <p className="mt-0.5 text-[11px] text-subtle">
                                {row.note}
                              </p>
                            ) : null}
                          </TD>
                          <TD className="capitalize">{row.tier}</TD>
                          <TD numeric>{row.seats}</TD>
                          <TD className="font-mono text-[11.5px] text-muted">
                            {row.redeemedByEmail ?? "—"}
                          </TD>
                          <TD numeric className="text-muted">
                            {formatDate(row.redeemedAt ?? row.revokedAt)}
                          </TD>
                          <TD>
                            <Badge
                              tone={STATUS_TONE[row.status]}
                              className="capitalize"
                            >
                              {row.status}
                            </Badge>
                          </TD>
                        </TRow>
                      ))}
                    </tbody>
                  </Table>
                </TableScroll>
                <Pagination
                  basePath="/admin/licenses"
                  params={{ status, tier }}
                  page={result.page}
                  pageCount={result.pageCount}
                  total={result.total}
                  pageSize={result.pageSize}
                  noun="codes"
                />
              </>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel
            title="Generate codes"
            description="Mint a batch for a launch, a partner or a support case."
          >
            <LicenseGenerator tiers={SELLABLE} />
          </Panel>

          <Panel
            title="Lifetime price list"
            description="What each redeemed code is worth."
          >
            <ul className="divide-y divide-line">
              {PLANS.map((plan) => (
                <li
                  key={plan.tier}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div>
                    <p className="text-[13px] font-medium">{plan.name}</p>
                    <p className="text-[11px] text-subtle">
                      {plan.limits.seats} seats · {plan.limits.workspaces} brands
                    </p>
                  </div>
                  <span className="font-mono text-[13px] font-semibold tabular">
                    {formatPrice(plan.priceCents.lifetime)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
