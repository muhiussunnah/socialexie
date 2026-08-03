import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { LicenseActivation } from "@/components/app/license-activation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { demoMetrics, demoWorkspace } from "@/lib/demo";
import { getCurrentTier, isPaidTier, planName } from "@/lib/licenses";
import { getPlan, limitsForTier } from "@/lib/plans";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

const TIMEZONES = [
  "UTC",
  "Europe/Stockholm",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dhaka",
  "Asia/Singapore",
  "Australia/Sydney",
];

function UsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px]">{label}</span>
        <span className="font-mono text-[12px] text-muted tabular">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-signal"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const tier = await getCurrentTier();
  const paid = isPaidTier(tier);
  const currentPlanName = planName(tier);
  const plan = getPlan(tier);
  const limits = limitsForTier(tier);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="font-display text-[26px] font-bold">Settings</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Workspace, publishing defaults, plan and licences.
        </p>
      </div>

      <LicenseActivation currentPlanName={currentPlanName} isPaid={paid} />

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Workspace</h2>
        <div className="mt-5 flex flex-col gap-4">
          <Field label="Name">
            <Input defaultValue={demoWorkspace.name} />
          </Field>
          <Field
            label="Publishing timezone"
            hint="Every scheduled time is interpreted in this zone, including across daylight-saving changes."
          >
            <Select defaultValue={demoWorkspace.timezone}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Brand voice"
            hint="Used as the default instruction for AI captions and images."
          >
            <Textarea
              rows={4}
              defaultValue="Warm, honest and a little funny. Never preachy. We help busy, phone-tired parents feel closer to their kids."
            />
          </Field>
          <div>
            <Button size="sm">Save changes</Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">Plan &amp; usage</h2>
            <p className="mt-1 text-[13px] text-muted">
              {plan
                ? `${plan.name} · ${formatPrice(plan.priceCents.monthly)}/mo or ${formatPrice(plan.priceCents.lifetime)} once`
                : "Free · 2 channels, no card required"}
            </p>
          </div>
          <Badge tone={paid ? "signal" : "info"}>{currentPlanName}</Badge>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <UsageRow
            label="AI images this month"
            used={Math.min(demoMetrics.imageCredits.used, limits.imageCredits)}
            limit={limits.imageCredits}
          />
          <UsageRow
            label="AI words this month"
            used={Math.min(demoMetrics.aiWords.used, limits.aiWords)}
            limit={limits.aiWords}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href="/pricing">Compare plans</Link>
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Publishing safety</h2>
        <p className="mt-1 text-[13px] text-muted">
          Guardrails that keep automated posting inside what the networks allow.
        </p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {[
            "Warn when the schedule exceeds 6 posts a day",
            "Flag keyword-comment calls to action before publishing",
            "Hold automated messages to the 24-hour window",
            "Cap automated replies at one per person per day",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[13.5px]">
              <Check className="mt-0.5 size-4 shrink-0 text-live" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-danger-soft p-5">
        <h2 className="text-[15px] font-semibold text-danger">Danger zone</h2>
        <p className="mt-1 text-[13px] text-muted">
          Deleting a workspace removes its queue, media and connected channels.
          This cannot be undone.
        </p>
        <div className="mt-4">
          <Button size="sm" variant="danger">
            Delete workspace
          </Button>
        </div>
      </Card>
    </div>
  );
}
