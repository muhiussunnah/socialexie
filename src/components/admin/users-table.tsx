"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, ClipboardCopy, MoreHorizontal } from "lucide-react";
import { formatCount, formatDate } from "@/components/admin/format";
import {
  Table,
  TableScroll,
  TD,
  TH,
  TRow,
} from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import type { AdminUserRow } from "@/lib/admin-data";
import type { PlanTierDb, SubscriptionStatus } from "@/lib/supabase/types";
import { cn, initials } from "@/lib/utils";

const TIER_TONE: Record<PlanTierDb, "neutral" | "info" | "signal" | "live"> = {
  free: "neutral",
  creator: "info",
  studio: "signal",
  agency: "live",
};

const STATUS_TONE: Record<
  SubscriptionStatus,
  "ok" | "info" | "warn" | "neutral" | "danger"
> = {
  active: "ok",
  trialing: "info",
  past_due: "warn",
  canceled: "neutral",
  expired: "danger",
};

const ROW_ACTIONS: { id: string; label: string; danger?: boolean }[] = [
  { id: "view", label: "View account" },
  { id: "plan", label: "Change plan" },
  { id: "suspend", label: "Suspend", danger: true },
];

export function UsersTable({ rows }: { rows: AdminUserRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allChecked = rows.length > 0 && selected.length === rows.length;

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const copyEmails = async () => {
    const emails = rows
      .filter((row) => selectedSet.has(row.id))
      .map((row) => row.email)
      .join(", ");
    try {
      await navigator.clipboard.writeText(emails);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; leaving the selection intact is enough.
    }
  };

  return (
    <div className="relative">
      <TableScroll>
        <Table>
          <thead>
            <tr>
              <TH className="w-9">
                <input
                  type="checkbox"
                  checked={allChecked}
                  aria-label="Select every user on this page"
                  onChange={() =>
                    setSelected(allChecked ? [] : rows.map((row) => row.id))
                  }
                  className="size-3.5 accent-[var(--signal)]"
                />
              </TH>
              <TH>User</TH>
              <TH>Plan</TH>
              <TH numeric>Workspaces</TH>
              <TH numeric>Posts</TH>
              <TH numeric>AI images</TH>
              <TH numeric>Joined</TH>
              <TH numeric>Last active</TH>
              <TH className="w-10">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const checked = selectedSet.has(row.id);
              return (
                <TRow key={row.id} className={cn(checked && "bg-signal-soft/40")}>
                  <TD>
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-label={`Select ${row.email}`}
                      onChange={() => toggle(row.id)}
                      className="size-3.5 accent-[var(--signal)]"
                    />
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[10.5px] font-semibold text-muted">
                        {initials(row.fullName ?? row.email.split("@")[0])}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">
                          {row.fullName ?? "No name set"}
                        </p>
                        <p className="truncate font-mono text-[11px] text-subtle">
                          {row.email}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={TIER_TONE[row.tier]} className="capitalize">
                        {row.tier}
                      </Badge>
                      <Badge tone={STATUS_TONE[row.status]} className="capitalize">
                        {row.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[10.5px] text-subtle">{row.billing}</p>
                  </TD>
                  <TD numeric>{row.workspaces}</TD>
                  <TD numeric>{formatCount(row.posts)}</TD>
                  <TD numeric>{formatCount(row.aiImages)}</TD>
                  <TD numeric className="text-muted">
                    {formatDate(row.joined)}
                  </TD>
                  <TD numeric className="text-muted">
                    {formatDate(row.lastActive)}
                  </TD>
                  <TD>
                    <div className="relative flex justify-end">
                      <button
                        type="button"
                        aria-label={`Actions for ${row.email}`}
                        aria-expanded={openMenu === row.id}
                        onClick={() =>
                          setOpenMenu((current) => (current === row.id ? null : row.id))
                        }
                        className="grid size-7 place-items-center rounded-lg border border-transparent text-subtle transition-colors hover:border-line hover:text-fg"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>

                      {openMenu === row.id ? (
                        <>
                          <button
                            type="button"
                            aria-hidden
                            tabIndex={-1}
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={() => setOpenMenu(null)}
                          />
                          <div
                            role="menu"
                            className="absolute top-8 right-0 z-50 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-e3"
                          >
                            {ROW_ACTIONS.map((action) => (
                              <button
                                key={action.id}
                                type="button"
                                role="menuitem"
                                onClick={() => setOpenMenu(null)}
                                className={cn(
                                  "block w-full px-3 py-1.5 text-left text-[12.5px] transition-colors hover:bg-surface-2",
                                  action.danger ? "text-danger" : "text-muted hover:text-fg",
                                )}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </TD>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </TableScroll>

      {selected.length > 0 ? (
        <div className="sticky bottom-3 z-20 mx-3 mt-3 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 shadow-e3">
          <span className="font-mono text-[12px] font-medium tabular">
            {selected.length} selected
          </span>
          <span className="h-4 w-px bg-line" />
          <BulkButton onClick={copyEmails}>
            {copied ? (
              <ClipboardCheck className="size-3.5 text-ok" />
            ) : (
              <ClipboardCopy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy emails"}
          </BulkButton>
          <BulkButton>Change plan</BulkButton>
          <BulkButton danger>Suspend</BulkButton>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="ml-auto text-[12px] text-subtle transition-colors hover:text-fg"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BulkButton({
  children,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] transition-colors",
        danger
          ? "text-danger hover:border-danger hover:bg-danger-soft"
          : "text-muted hover:border-line-strong hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
