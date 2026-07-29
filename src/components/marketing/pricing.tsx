"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Infinity as InfinityIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import {
  PLANS,
  lifetimeBreakEvenMonths,
  type BillingMode,
  type Plan,
} from "@/lib/plans";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "monthly" as const, label: "Monthly" },
  { value: "lifetime" as const, label: "One-time", note: "Own it" },
];

function PlanCard({ plan, mode }: { plan: Plan; mode: BillingMode }) {
  const price = plan.priceCents[mode];
  const breakEven = lifetimeBreakEvenMonths(plan);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-panel border bg-surface p-6",
        plan.featured
          ? "border-signal shadow-signal lg:-my-3 lg:py-9"
          : "border-line shadow-e1",
      )}
    >
      {plan.featured ? (
        <Badge tone="signal" className="absolute -top-2.5 left-6">
          Most chosen
        </Badge>
      ) : null}

      <h3 className="font-display text-[19px] font-bold">{plan.name}</h3>
      <p className="mt-1 text-[13px] text-muted">{plan.tagline}</p>

      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="font-display text-[38px] leading-none font-extrabold tabular">
          {formatPrice(price)}
        </span>
        <span className="text-[13px] text-muted">
          {mode === "monthly" ? "/ month" : "once"}
        </span>
      </div>

      <p className="mt-2 min-h-[18px] text-[12px] text-subtle">
        {mode === "lifetime"
          ? `Pays for itself after ${breakEven} months`
          : "Cancel any time"}
      </p>

      <Button
        asChild
        className="mt-6"
        variant={plan.featured ? "primary" : "secondary"}
      >
        <Link href={`/signup?plan=${plan.tier}&billing=${mode}`}>
          {mode === "lifetime" ? `Get ${plan.name} for life` : `Start ${plan.name}`}
        </Link>
      </Button>

      <ul className="mt-6 flex flex-col gap-2.5 border-t border-line pt-6">
        {plan.highlights.map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-[13.5px]">
            <Check className="mt-0.5 size-4 shrink-0 text-live" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-5 text-[12px]">
        {[
          ["Brands", plan.limits.workspaces],
          ["Seats", plan.limits.seats],
          ["Queue", plan.limits.queuedPosts],
          ["History", `${plan.limits.analyticsMonths} mo`],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between gap-2">
            <dt className="text-subtle">{label}</dt>
            <dd className="font-medium tabular">
              {value === null ? (
                <InfinityIcon className="size-3.5" aria-label="Unlimited" />
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Pricing({ standalone = false }: { standalone?: boolean }) {
  const [mode, setMode] = useState<BillingMode>("monthly");

  return (
    <section
      id="pricing"
      className={cn("py-20", !standalone && "border-t border-line bg-bg-sub")}
    >
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-signal uppercase">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.5rem)] font-bold">
            Rent it monthly, or own it outright
          </h2>
          <p className="mt-3 text-[15.5px] leading-relaxed text-muted">
            Same product either way. The one-time licence never renews — you
            keep the tier and every update that ships to it.
          </p>

          <div className="mt-7 flex justify-center">
            <Segmented
              name="Billing mode"
              value={mode}
              options={MODES}
              onChange={setMode}
            />
          </div>
        </div>

        <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.tier} plan={plan} mode={mode} />
          ))}
        </div>

        <p className="mt-8 text-center text-[12.5px] text-subtle">
          Every plan includes the AI studio, evergreen recycling, bulk import
          and analytics. Start on the free tier with 2 channels — upgrade when
          the queue outgrows it.
        </p>
      </div>
    </section>
  );
}
