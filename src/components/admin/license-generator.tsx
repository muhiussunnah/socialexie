"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { generateLicensesAction } from "@/app/admin/licenses/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { PlanTierDb } from "@/lib/supabase/types";

export function LicenseGenerator({
  tiers,
}: {
  tiers: { value: PlanTierDb; label: string }[];
}) {
  const [tier, setTier] = useState<PlanTierDb>(tiers[0]?.value ?? "creator");
  const [quantity, setQuantity] = useState(10);
  const [note, setNote] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateLicensesAction({ tier, quantity, note });
      if (result.ok) {
        setCodes(result.codes);
        setCopied(false);
      } else {
        setError(result.error);
        setCodes([]);
      }
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // The block stays selectable, so a denied clipboard is not a dead end.
    }
  };

  const count = Math.min(500, Math.max(1, Math.round(quantity) || 1));

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_100px]">
        <Field label="Tier">
          <Select
            value={tier}
            onChange={(event) => setTier(event.target.value as PlanTierDb)}
            className="h-9 text-[13px]"
          >
            {tiers.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity">
          <Input
            type="number"
            min={1}
            max={500}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="h-9 text-[13px] tabular"
          />
        </Field>
      </div>

      <Field label="Note" hint="Saved next to every code in the batch.">
        <Input
          value={note}
          placeholder="Launch batch 4"
          onChange={(event) => setNote(event.target.value)}
          className="h-9 text-[13px]"
        />
      </Field>

      <Button
        size="sm"
        onClick={generate}
        disabled={pending}
        className="self-start"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {pending ? "Saving…" : `Generate ${count} codes`}
      </Button>

      {error ? (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      {codes.length > 0 ? (
        <div className="rounded-lg border border-line bg-surface-2">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="text-[12px] text-muted">
              {codes.length} codes · <span className="capitalize">{tier}</span>
              {note ? ` · ${note}` : ""}
            </p>
            <button
              type="button"
              onClick={copy}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {copied ? (
                <Check className="size-3.5 text-ok" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy all"}
            </button>
          </div>
          <pre className="max-h-56 overflow-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed text-fg tabular">
            {codes.join("\n")}
          </pre>
        </div>
      ) : (
        <p className="text-[12px] text-subtle">
          Each batch is saved and ready to redeem the moment you generate it.
          Copy the codes here to hand them out.
        </p>
      )}
    </div>
  );
}
