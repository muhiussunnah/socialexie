import { Suspense } from "react";
import type { Metadata } from "next";
import { DemoNotice } from "@/components/admin/demo-notice";
import { AdminFilters } from "@/components/admin/filters";
import { formatCount, formatStamp, previewJson } from "@/components/admin/format";
import {
  EmptyState,
  Pagination,
  Panel,
  Table,
  TableScroll,
  TableSkeleton,
  TD,
  TH,
  TRow,
} from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { listAuditEntries } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 40;

/** Entity prefix decides the tone, so a failure never reads as routine. */
function toneFor(action: string): "neutral" | "ok" | "warn" | "danger" | "info" {
  if (action.endsWith(".failed") || action.endsWith(".deleted")) return "danger";
  if (action.endsWith(".revoked") || action.endsWith(".paused")) return "warn";
  if (action.startsWith("license.") || action.startsWith("post.")) return "ok";
  if (action.startsWith("user.")) return "info";
  return "neutral";
}

interface Filters {
  action: string;
  from: string;
  to: string;
  page: string;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const query = await searchParams;
  const filters: Filters = {
    action: first(query.action) ?? "all",
    from: isDate(first(query.from)) ? (first(query.from) as string) : "",
    to: isDate(first(query.to)) ? (first(query.to) as string) : "",
    page: first(query.page) ?? "1",
  };

  // The action list comes from the log itself, so the filter can never offer
  // an action nobody has ever performed.
  const { actions } = await listAuditEntries({ pageSize: 1 });

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
      <DemoNotice />

      <div>
        <h1 className="font-display text-[21px] font-bold">Audit log</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Append-only record of what changed, who changed it and when. Timestamps
          are UTC.
        </p>
      </div>

      <AdminFilters
        basePath="/admin/audit"
        params={{ ...filters }}
        selects={[
          {
            key: "action",
            label: "Action",
            options: [
              { value: "all", label: "All actions" },
              ...actions.map((action) => ({ value: action, label: action })),
            ],
          },
        ]}
        dates={{ fromKey: "from", toKey: "to" }}
      />

      <Suspense
        key={`${filters.action}|${filters.from}|${filters.to}|${filters.page}`}
        fallback={
          <Panel title="Entries" description="Loading…">
            <TableSkeleton rows={12} columns={5} />
          </Panel>
        }
      >
        <AuditSection filters={filters} />
      </Suspense>
    </div>
  );
}

async function AuditSection({ filters }: { filters: Filters }) {
  const result = await listAuditEntries({
    action: filters.action,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page: Number.parseInt(filters.page, 10) || 1,
    pageSize: PAGE_SIZE,
  });

  return (
    <Panel
      title="Entries"
      description={`${formatCount(result.total)} matching this filter`}
    >
      {result.rows.length === 0 ? (
        <EmptyState
          title="No entries"
          description="Nothing was recorded for this action inside the selected dates. Widen the range or clear the action filter."
        />
      ) : (
        <>
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <TH>Timestamp</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                  <TH>Entity</TH>
                  <TH>Metadata</TH>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((entry) => (
                  <TRow key={entry.id}>
                    <TD className="font-mono text-[11.5px] whitespace-nowrap text-muted tabular">
                      {formatStamp(entry.createdAt)}
                    </TD>
                    <TD className="font-mono text-[11.5px]">
                      {entry.actorEmail ?? (
                        <span className="text-subtle">system</span>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={toneFor(entry.action)} className="font-mono">
                        {entry.action}
                      </Badge>
                    </TD>
                    <TD>
                      <p className="text-[12.5px] capitalize">
                        {entry.entity ?? "—"}
                      </p>
                      <p className="font-mono text-[11px] text-subtle">
                        {entry.workspaceName ?? entry.entityId ?? ""}
                      </p>
                    </TD>
                    <TD className="max-w-[320px] font-mono text-[11.5px] text-subtle">
                      <span className="block truncate" title={JSON.stringify(entry.metadata)}>
                        {previewJson(entry.metadata)}
                      </span>
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </TableScroll>
          <Pagination
            basePath="/admin/audit"
            params={{
              action: filters.action,
              from: filters.from,
              to: filters.to,
            }}
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
            noun="entries"
          />
        </>
      )}
    </Panel>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isDate(value: string | undefined): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
