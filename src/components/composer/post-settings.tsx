"use client";

import { Field, Input, Select } from "@/components/ui/field";
import { formatDuration, isVideoFormat } from "@/lib/post-validation";
import { getPlatform, type PlatformId, type PostFormat } from "@/lib/platforms";
import { demoCategories } from "@/lib/demo";

const FORMAT_OPTIONS: { value: PostFormat; label: string }[] = [
  { value: "text", label: "Text only" },
  { value: "image", label: "Single image" },
  { value: "carousel", label: "Carousel" },
  { value: "video", label: "Video" },
  { value: "reel", label: "Reel" },
  { value: "short", label: "Short" },
  { value: "story", label: "Story" },
];

interface VideoBounds {
  minSeconds: number;
  maxSeconds: number;
}

export function PostSettings({
  targets,
  format,
  onFormatChange,
  videoSeconds,
  onVideoSecondsChange,
  category,
  onCategoryChange,
}: {
  targets: readonly PlatformId[];
  format: PostFormat;
  onFormatChange: (format: PostFormat) => void;
  videoSeconds: string;
  onVideoSecondsChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
}) {
  const rejecting = targets.filter(
    (id) => !getPlatform(id).formats.includes(format),
  );

  const bounds = targets
    .map((id) => getPlatform(id).video)
    .filter((video): video is VideoBounds => video !== undefined);
  const floor = bounds.reduce((max, video) => Math.max(max, video.minSeconds), 0);
  const ceiling = bounds.reduce(
    (min, video) => Math.min(min, video.maxSeconds),
    Number.POSITIVE_INFINITY,
  );
  const showRange = bounds.length > 0 && Number.isFinite(ceiling);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field
        label="Format"
        hint={
          rejecting.length > 0
            ? `Not accepted by ${rejecting.map((id) => getPlatform(id).name).join(", ")}`
            : "Accepted everywhere you selected"
        }
      >
        <Select
          value={format}
          onChange={(event) => onFormatChange(event.target.value as PostFormat)}
        >
          {FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      {isVideoFormat(format) ? (
        <Field
          label="Clip length"
          hint={
            showRange
              ? `Safe range ${formatDuration(floor)}–${formatDuration(ceiling)}`
              : "Length in seconds"
          }
        >
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Seconds"
            value={videoSeconds}
            onChange={(event) => onVideoSecondsChange(event.target.value)}
          />
        </Field>
      ) : null}

      <Field label="Category" hint="Drives recycling and the content mix">
        <Select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          {demoCategories.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
