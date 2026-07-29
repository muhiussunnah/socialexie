"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface FilterSelectSpec {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface FilterSearchSpec {
  key: string;
  placeholder: string;
}

export interface FilterDateSpec {
  fromKey: string;
  toKey: string;
}

/**
 * Filters live in the URL rather than in component state: the server does the
 * querying, and a filtered view stays shareable and reloadable.
 */
export function AdminFilters({
  basePath,
  params,
  search,
  selects = [],
  dates,
}: {
  basePath: string;
  params: Record<string, string>;
  search?: FilterSearchSpec;
  selects?: FilterSelectSpec[];
  dates?: FilterDateSpec;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState(search ? (params[search.key] ?? "") : "");
  const typed = useRef(false);

  const navigate = (next: Record<string, string>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "all") query.set(key, value);
    }
    const qs = query.toString();
    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
  };

  // Paging is meaningless once the result set changes underneath it.
  const setParam = (key: string, value: string) => {
    const next: Record<string, string> = { ...params, [key]: value };
    delete next.page;
    navigate(next);
  };

  useEffect(() => {
    if (!search || !typed.current) return;
    const id = setTimeout(() => setParam(search.key, term.trim()), 320);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const active =
    Object.entries(params).filter(
      ([key, value]) => key !== "page" && value && value !== "all",
    ).length > 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-2.5 transition-opacity",
        pending && "opacity-60",
      )}
    >
      {search ? (
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">{search.placeholder}</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
          <Input
            type="search"
            value={term}
            placeholder={search.placeholder}
            onChange={(event) => {
              typed.current = true;
              setTerm(event.target.value);
            }}
            className="h-9 pl-8.5 text-[13px]"
          />
        </label>
      ) : null}

      {selects.map((spec) => (
        <label key={spec.key} className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold tracking-[0.12em] text-subtle uppercase">
            {spec.label}
          </span>
          <Select
            value={params[spec.key] ?? "all"}
            onChange={(event) => setParam(spec.key, event.target.value)}
            className="h-9 w-auto min-w-[132px] text-[13px]"
          >
            {spec.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      ))}

      {dates ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold tracking-[0.12em] text-subtle uppercase">
              From
            </span>
            <Input
              type="date"
              value={params[dates.fromKey] ?? ""}
              onChange={(event) => setParam(dates.fromKey, event.target.value)}
              className="h-9 w-auto text-[13px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold tracking-[0.12em] text-subtle uppercase">
              To
            </span>
            <Input
              type="date"
              value={params[dates.toKey] ?? ""}
              onChange={(event) => setParam(dates.toKey, event.target.value)}
              className="h-9 w-auto text-[13px]"
            />
          </label>
        </>
      ) : null}

      {active ? (
        <button
          type="button"
          onClick={() => {
            setTerm("");
            typed.current = false;
            navigate({});
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12.5px] text-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </button>
      ) : null}
    </div>
  );
}
