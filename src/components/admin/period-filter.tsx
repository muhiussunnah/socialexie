"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import type { OverviewPeriod } from "@/lib/admin-data";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "lifetime" as const, label: "Lifetime" },
  { value: "30d" as const, label: "Last 30 days" },
  { value: "ytd" as const, label: "This year" },
];

/** Writes the window into the URL so the server recomputes every figure. */
export function PeriodFilter({ value }: { value: OverviewPeriod }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Segmented
      name="Reporting period"
      size="sm"
      value={value}
      options={OPTIONS}
      className={cn("transition-opacity", pending && "opacity-60")}
      onChange={(next: OverviewPeriod) => {
        startTransition(() => {
          router.replace(next === "lifetime" ? "/admin" : `/admin?period=${next}`, {
            scroll: false,
          });
        });
      }}
    />
  );
}
