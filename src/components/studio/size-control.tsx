"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/field";
import {
  CUSTOM_SIZE_BOUNDS,
  SIZE_PRESETS,
  clampDimension,
} from "@/lib/platforms";
import { cn } from "@/lib/utils";

export interface CanvasSize {
  width: number;
  height: number;
  /** Null once the width or height has been hand-edited. */
  presetId: string | null;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/** "1080 × 1350" reads as "4:5"; anything that won't reduce falls back to a decimal. */
export function aspectLabel(width: number, height: number): string {
  const divisor = greatestCommonDivisor(width, height) || 1;
  const w = width / divisor;
  const h = height / divisor;
  if (w <= 40 && h <= 40) return `${w}:${h}`;
  const ratio = width / height;
  return ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(1 / ratio).toFixed(2)}`;
}

/** Scale a canvas down to a thumbnail whose long edge is `long` pixels. */
function thumbnail(width: number, height: number, long = 32) {
  const scale = long / Math.max(width, height);
  return {
    width: Math.max(8, Math.round(width * scale)),
    height: Math.max(8, Math.round(height * scale)),
  };
}

export function SizeControl({
  value,
  onChange,
  disabled,
}: {
  value: CanvasSize;
  onChange: (next: CanvasSize) => void;
  disabled?: boolean;
}) {
  // The fields hold raw text while they are being typed, so a preset click has
  // to overwrite them. Adjusting during render keeps that in one pass instead
  // of flashing the stale value first.
  const [draft, setDraft] = useState({
    width: String(value.width),
    height: String(value.height),
  });
  const [synced, setSynced] = useState({
    width: value.width,
    height: value.height,
  });

  if (synced.width !== value.width || synced.height !== value.height) {
    setSynced({ width: value.width, height: value.height });
    setDraft({ width: String(value.width), height: String(value.height) });
  }

  const commit = (field: "width" | "height", raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const next = clampDimension(Number.isFinite(parsed) ? parsed : value[field]);
    onChange({ ...value, [field]: next, presetId: null });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Canvas</Label>
        <span className="font-mono text-[11px] text-subtle tabular">
          {value.width} × {value.height} · {aspectLabel(value.width, value.height)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {SIZE_PRESETS.map((preset) => {
          const active = value.presetId === preset.id;
          const box = thumbnail(preset.width, preset.height);
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() =>
                onChange({
                  width: preset.width,
                  height: preset.height,
                  presetId: preset.id,
                })
              }
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors",
                "disabled:pointer-events-none disabled:opacity-45",
                active
                  ? "border-signal bg-signal-soft"
                  : "border-line bg-surface-2 hover:border-line-strong",
              )}
            >
              <span className="grid h-9 place-items-center">
                <span
                  className={cn(
                    "block rounded-[3px] border",
                    active
                      ? "border-signal bg-signal/25"
                      : "border-line-strong bg-surface-3",
                  )}
                  style={{ width: box.width, height: box.height }}
                />
              </span>
              <span
                className={cn(
                  "text-center text-[10.5px] leading-tight",
                  active ? "text-signal" : "text-muted",
                )}
              >
                {preset.label}
              </span>
              <span className="font-mono text-[9.5px] text-subtle tabular">
                {aspectLabel(preset.width, preset.height)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-subtle">Width</span>
          <Input
            type="number"
            inputMode="numeric"
            disabled={disabled}
            min={CUSTOM_SIZE_BOUNDS.min}
            max={CUSTOM_SIZE_BOUNDS.max}
            step={CUSTOM_SIZE_BOUNDS.step}
            value={draft.width}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, width: event.target.value }))
            }
            onBlur={(event) => commit("width", event.target.value)}
            className="h-9 font-mono text-[13px] tabular"
          />
        </label>
        <span className="pb-2.5 text-[12px] text-subtle">×</span>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-subtle">Height</span>
          <Input
            type="number"
            inputMode="numeric"
            disabled={disabled}
            min={CUSTOM_SIZE_BOUNDS.min}
            max={CUSTOM_SIZE_BOUNDS.max}
            step={CUSTOM_SIZE_BOUNDS.step}
            value={draft.height}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, height: event.target.value }))
            }
            onBlur={(event) => commit("height", event.target.value)}
            className="h-9 font-mono text-[13px] tabular"
          />
        </label>
      </div>

      <p className="text-[11px] text-subtle">
        Snapped to {CUSTOM_SIZE_BOUNDS.step}px steps between{" "}
        {CUSTOM_SIZE_BOUNDS.min} and {CUSTOM_SIZE_BOUNDS.max}.
      </p>
    </div>
  );
}
