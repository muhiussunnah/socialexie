"use client";

import { useId } from "react";
import { CircleAlert, RefreshCw, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { ModelPicker } from "@/components/studio/model-picker";
import { SizeControl, type CanvasSize } from "@/components/studio/size-control";
import type { ModelOption, ProviderStatus } from "@/lib/ai/types";
import { PLATFORM_LIST, type PlatformId } from "@/lib/platforms";
import { cn, formatPrice } from "@/lib/utils";

const PROMPT_LIMIT = 2_000;

function CountControl({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: max }, (_, index) => index + 1).map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(n)}
              className={cn(
                "h-8 rounded-lg border font-mono text-[12px] transition-colors tabular",
                "disabled:pointer-events-none disabled:opacity-45",
                active
                  ? "border-signal bg-signal-soft font-semibold text-signal"
                  : "border-line bg-surface-2 text-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PromptPanel({
  mode,
  prompt,
  onPromptChange,
  style,
  onStyleChange,
  modelId,
  onModelChange,
  modelOptions,
  providers,
  size,
  onSizeChange,
  count,
  onCountChange,
  platform,
  onPlatformChange,
  estimateCents,
  simulated,
  busy,
  onGenerate,
  onCancel,
}: {
  mode: "image" | "caption";
  prompt: string;
  onPromptChange: (value: string) => void;
  style: string;
  onStyleChange: (value: string) => void;
  modelId: string;
  onModelChange: (value: string) => void;
  modelOptions: readonly ModelOption[];
  providers: readonly ProviderStatus[];
  size: CanvasSize;
  onSizeChange: (next: CanvasSize) => void;
  count: number;
  onCountChange: (value: number) => void;
  platform: PlatformId | "";
  onPlatformChange: (value: PlatformId | "") => void;
  estimateCents: number;
  simulated: boolean;
  busy: boolean;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  const promptId = useId();
  const styleId = useId();
  const modelId_ = useId();
  const platformId = useId();

  const isImage = mode === "image";
  const overLimit = prompt.length > PROMPT_LIMIT;
  const ready = prompt.trim().length > 0 && !overLimit;

  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">Brief</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {isImage
              ? "What should the frame show?"
              : "What is the post about?"}
          </p>
        </div>
        <span
          className={cn(
            "font-mono text-[11px] tabular",
            overLimit ? "text-danger" : "text-subtle",
          )}
        >
          {prompt.length}/{PROMPT_LIMIT}
        </span>
      </div>

      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={promptId}>Prompt</Label>
          <Textarea
            id={promptId}
            value={prompt}
            disabled={busy}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder={
              isImage
                ? "Golden-hour shot of a family cooking together in a bright kitchen, shallow depth of field, warm film grain"
                : "Announce the phone-free dinner challenge and invite people to try it for a week"
            }
            className="min-h-36 text-[13.5px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={styleId}>
            {isImage ? "Style" : "Brand voice"}
          </Label>
          <Input
            id={styleId}
            value={style}
            disabled={busy}
            onChange={(event) => onStyleChange(event.target.value)}
            placeholder={
              isImage
                ? "editorial photography, muted palette, no text overlay"
                : "warm, plain-spoken, never salesy"
            }
            className="text-[13px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={modelId_}>Model</Label>
          <ModelPicker
            id={modelId_}
            options={modelOptions}
            providers={providers}
            value={modelId}
            disabled={busy}
            onChange={onModelChange}
          />
          <p className="text-[11px] text-subtle">
            Unavailable models are missing an API key. The router falls back to
            the next configured provider if a call fails.
          </p>
        </div>

        {isImage ? (
          <>
            <SizeControl value={size} onChange={onSizeChange} disabled={busy} />
            <CountControl
              label="Batch"
              value={count}
              max={8}
              disabled={busy}
              onChange={onCountChange}
            />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={platformId}>Network</Label>
              <Select
                id={platformId}
                value={platform}
                disabled={busy}
                onChange={(event) =>
                  onPlatformChange(event.target.value as PlatformId | "")
                }
                className="text-[13px]"
              >
                <option value="">Any network — 600 char cap</option>
                {PLATFORM_LIST.map((spec) => (
                  <option key={spec.id} value={spec.id}>
                    {spec.name} — {spec.captionLimit.toLocaleString()} chars
                    {spec.maxHashtags ? `, ${spec.maxHashtags} hashtags` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <CountControl
              label="Options"
              value={count}
              max={8}
              disabled={busy}
              onChange={onCountChange}
            />
          </>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        <div>
          <p className="text-[10px] tracking-[0.12em] text-subtle uppercase">
            Estimate
          </p>
          {simulated ? (
            <Badge tone="warn" className="mt-1">
              <CircleAlert className="size-3" />
              Simulated · no charge
            </Badge>
          ) : (
            <p className="mt-0.5 font-mono text-[13.5px] font-semibold tabular">
              ~{formatPrice(estimateCents)}
              <span className="ml-1 font-sans text-[11px] font-normal text-subtle">
                for {count}
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {busy ? (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button onClick={onGenerate} disabled={busy || !ready}>
            {busy ? (
              <RefreshCw className="animate-pulse-live" />
            ) : (
              <WandSparkles />
            )}
            {busy ? "Generating" : "Generate"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
