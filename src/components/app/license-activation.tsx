"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { redeemLicenseAction } from "@/app/(app)/dashboard/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

/**
 * Redeem a one-time licence key. The heavy lifting — validating the code,
 * claiming it atomically and applying the tier — happens in a server action;
 * this only collects the key and reflects the result.
 */
export function LicenseActivation({
  currentPlanName,
  isPaid,
}: {
  currentPlanName: string;
  isPaid: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const code = String(
      new FormData(event.currentTarget).get("code") ?? "",
    ).trim();
    if (!code) {
      setError("Enter your licence key.");
      return;
    }

    startTransition(async () => {
      const result = await redeemLicenseAction(code);
      if (result.ok) {
        setSuccess(`Activated — you're on ${result.plan} for life. 🎉`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Activate a licence</h2>
          <p className="mt-1 text-[13px] text-muted">
            Bought a one-time licence? Enter the key to unlock its plan for life
            — no card, never renews.
          </p>
        </div>
        <Badge tone={isPaid ? "signal" : "info"}>Current: {currentPlanName}</Badge>
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <Field label="Licence key">
          <Input
            name="code"
            placeholder="SLX-XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono tracking-[0.06em] uppercase"
          />
        </Field>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Activate licence
          </Button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="mt-3 flex items-center gap-1.5 text-[13px] text-ok"
        >
          <CheckCircle2 className="size-4" aria-hidden />
          {success}
        </p>
      ) : null}
    </Card>
  );
}
