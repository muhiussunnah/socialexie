import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Dense table chrome shared by every list in the console. */

export function Panel({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-card border border-line bg-surface shadow-e1",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[13.5px] font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[12px] text-subtle">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
      {children}
    </table>
  );
}

export function TH({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-surface-2 px-3 py-2 text-[10.5px] font-semibold tracking-[0.12em] text-subtle uppercase",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle",
        numeric && "text-right font-mono text-[12.5px] tabular",
        className,
      )}
      {...props}
    />
  );
}

export function TRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-line last:border-b-0 transition-colors hover:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Column header that re-sorts through the URL, so the order survives a reload
 * and can be shared with another operator.
 */
export function SortHeader({
  label,
  field,
  active,
  direction,
  href,
  numeric,
}: {
  label: string;
  field: string;
  active: boolean;
  direction: "asc" | "desc";
  href: string;
  numeric?: boolean;
}) {
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TH numeric={numeric} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={href}
        data-field={field}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-fg",
          active && "text-fg",
          numeric && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className="size-3 opacity-70" />
      </Link>
    </TH>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="font-display text-[15px] font-semibold">{title}</p>
      <p className="max-w-sm text-[13px] text-muted">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Placeholder shown while a filtered query streams in. */
export function TableSkeleton({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="p-3" aria-hidden>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center gap-3">
            {Array.from({ length: columns }).map((_, col) => (
              <div
                key={col}
                className="h-4 flex-1 animate-pulse rounded bg-surface-3"
                style={{
                  animationDelay: `${(row * columns + col) * 24}ms`,
                  maxWidth: col === 0 ? "22%" : undefined,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading results</span>
    </div>
  );
}

function withPage(
  basePath: string,
  params: Record<string, string>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "all") search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  basePath,
  params,
  page,
  pageCount,
  total,
  pageSize,
  noun = "rows",
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  noun?: string;
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
      <p className="font-mono text-[11.5px] text-subtle tabular">
        {first}–{last} of {total.toLocaleString("en-US")} {noun}
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <PageLink
          href={withPage(basePath, params, page - 1)}
          disabled={page <= 1}
          label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </PageLink>
        <span className="px-2 font-mono text-[11.5px] text-muted tabular">
          {page} / {pageCount}
        </span>
        <PageLink
          href={withPage(basePath, params, page + 1)}
          disabled={page >= pageCount}
          label="Next page"
        >
          <ChevronRight className="size-4" />
        </PageLink>
      </nav>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const classes =
    "grid size-8 place-items-center rounded-lg border border-line text-muted transition-colors";
  if (disabled) {
    return (
      <span aria-hidden className={cn(classes, "opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(classes, "hover:border-line-strong hover:text-fg")}
    >
      {children}
    </Link>
  );
}
