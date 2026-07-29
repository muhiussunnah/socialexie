"use client";

import { Select } from "@/components/ui/field";
import type { ModelOption, ProviderId, ProviderStatus } from "@/lib/ai/types";
import { formatPrice } from "@/lib/utils";

/** Auto-routing sentinel: the server picks the cheapest configured model. */
export const AUTO_MODEL = "";

function priceHint(option: ModelOption): string {
  const { approxCentsPerImage, approxCentsPerMTok } = option.model;
  if (approxCentsPerImage !== undefined) {
    return `${formatPrice(approxCentsPerImage)}/image`;
  }
  if (approxCentsPerMTok !== undefined) {
    return `${formatPrice(approxCentsPerMTok)}/M tokens`;
  }
  return "";
}

export function ModelPicker({
  id,
  options,
  providers,
  value,
  onChange,
  disabled,
}: {
  id: string;
  options: readonly ModelOption[];
  providers: readonly ProviderStatus[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const labels = new Map<ProviderId, string>(
    providers.map((provider) => [provider.id, provider.label]),
  );

  const grouped = options.reduce<Map<ProviderId, ModelOption[]>>((map, option) => {
    const bucket = map.get(option.model.provider) ?? [];
    bucket.push(option);
    map.set(option.model.provider, bucket);
    return map;
  }, new Map());

  return (
    <Select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="text-[13px]"
    >
      <option value={AUTO_MODEL}>Auto — cheapest configured model</option>
      {[...grouped.entries()].map(([provider, bucket]) => {
        const available = bucket.some((option) => option.available);
        return (
          <optgroup
            key={provider}
            label={`${labels.get(provider) ?? provider}${available ? "" : " · no API key"}`}
          >
            {bucket.map((option) => (
              <option
                key={option.model.id}
                value={option.model.id}
                disabled={!option.available}
              >
                {option.model.label}
                {priceHint(option) ? ` — ${priceHint(option)}` : ""}
                {option.available ? "" : " (unavailable)"}
              </option>
            ))}
          </optgroup>
        );
      })}
    </Select>
  );
}
