"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelPicker } from "@/components/composer/channel-picker";
import { Editor, type EditorTab } from "@/components/composer/editor";
import {
  MediaDropzone,
  type MediaItem,
} from "@/components/composer/media-dropzone";
import { PostSettings } from "@/components/composer/post-settings";
import { PreviewPanel } from "@/components/composer/preview";
import {
  SchedulePanel,
  type ScheduleMode,
} from "@/components/composer/schedule-panel";
import { ValidationPanel } from "@/components/composer/validation-panel";
import {
  extractHashtags,
  validateForPlatform,
  type Issue,
} from "@/lib/post-validation";
import type { PlatformId, PostFormat } from "@/lib/platforms";
import {
  buildQueue,
  DEFAULT_SLOTS,
  formatZonedDate,
  formatZonedTime,
  zonedInstant,
} from "@/lib/scheduling";

const STARTER_BODY = `The 10-minute rule that ended our bedtime war.

We stopped negotiating and started narrating: "ten more minutes, then lights out" — said once, meant once. Week one was loud. Week three was quiet.

Comment BEDTIME and I'll send the one-page version.

#gentleparenting #toddlerlife #bedtimeroutine`;

const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function Composer({
  nowIso,
  timeZone,
}: {
  nowIso: string;
  timeZone: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const [targets, setTargets] = useState<PlatformId[]>(["facebook", "threads"]);
  const [base, setBase] = useState(STARTER_BODY);
  const [overrides, setOverrides] = useState<Partial<Record<PlatformId, string>>>({});
  const [tab, setTab] = useState<EditorTab>("base");
  const [previewChoice, setPreviewChoice] = useState<PlatformId | null>(null);
  const [format, setFormat] = useState<PostFormat>("text");
  const [videoSeconds, setVideoSeconds] = useState("");
  const [category, setCategory] = useState("Stories");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mode, setMode] = useState<ScheduleMode>("queue");
  const [at, setAt] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  const mediaIdRef = useRef(0);
  const mediaRef = useRef<MediaItem[]>([]);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);
  // Object URLs leak until they are revoked, and the previews outlive any
  // single render, so the cleanup reads the latest list on unmount.
  useEffect(
    () => () => {
      for (const item of mediaRef.current) URL.revokeObjectURL(item.url);
    },
    [],
  );

  // Tabs and the preview follow the selection instead of holding a stale
  // channel, so nothing has to be reconciled in an effect.
  const activeTab: EditorTab =
    tab === "base" || targets.includes(tab) ? tab : "base";
  const previewPlatform =
    previewChoice && targets.includes(previewChoice)
      ? previewChoice
      : (targets[0] ?? null);

  const captionFor = (platform: PlatformId) => overrides[platform] ?? base;
  const seconds =
    videoSeconds.trim() === "" || Number.isNaN(Number(videoSeconds))
      ? undefined
      : Number(videoSeconds);

  // Captions diverge per network once a tab is overridden, so each target is
  // checked against the body it will actually publish rather than the base.
  const issues = useMemo(() => {
    const result = {} as Record<PlatformId, Issue[]>;
    for (const platform of targets) {
      const body = overrides[platform] ?? base;
      result[platform] = validateForPlatform(
        {
          body,
          format,
          mediaCount: media.length,
          videoSeconds: seconds,
          hashtags: extractHashtags(body),
          targets,
        },
        platform,
      );
    }
    return result;
  }, [targets, overrides, base, format, media.length, seconds]);

  const blocked = targets.some((platform) =>
    (issues[platform] ?? []).some((issue) => issue.level === "error"),
  );

  function toggleTarget(platform: PlatformId) {
    setReceipt(null);
    setTargets((current) =>
      current.includes(platform)
        ? current.filter((id) => id !== platform)
        : [...current, platform],
    );
  }

  function addMedia(files: File[]) {
    setReceipt(null);
    setMedia((current) => [
      ...current,
      ...files.map((file) => ({
        id: `media-${mediaIdRef.current++}`,
        name: file.name,
        kind: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
        url: URL.createObjectURL(file),
      })),
    ]);
  }

  function removeMedia(id: string) {
    setMedia((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return current.filter((entry) => entry.id !== id);
    });
  }

  function submit() {
    const channels = `${targets.length} channel${targets.length === 1 ? "" : "s"}`;

    if (mode === "now") {
      setReceipt(`Sent to ${channels}. Watch the run in Analytics.`);
      return;
    }

    if (mode === "at") {
      const match = DATETIME_PATTERN.exec(at);
      if (!match) {
        setReceipt("Pick a date and time first.");
        return;
      }
      const when = zonedInstant(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        timeZone,
      );
      setReceipt(
        `Scheduled for ${formatZonedDate(when, timeZone)} at ${formatZonedTime(when, timeZone)} · ${channels}.`,
      );
      return;
    }

    const [first] = buildQueue(DEFAULT_SLOTS, now, timeZone, 1);
    setReceipt(
      first
        ? `Queued for ${formatZonedDate(first, timeZone)} at ${formatZonedTime(first, timeZone)} · ${channels}.`
        : "Add a slot to the posting plan before queueing.",
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold">Composer</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            One draft, every network, checked against each platform&apos;s real
            rules before it leaves.
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[12px] text-muted tabular">
          {category} · {timeZone}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle>Channels</CardTitle>
                <CardDescription>
                  {targets.length === 0
                    ? "Nothing selected yet"
                    : `Publishing to ${targets.length} of 8`}
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <ChannelPicker selected={targets} onToggle={toggleTarget} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle>Caption</CardTitle>
                <CardDescription>
                  Write once, then tune any network without losing the base.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <Editor
                targets={targets}
                base={base}
                overrides={overrides}
                active={activeTab}
                onActiveChange={setTab}
                onBaseChange={(value) => {
                  setReceipt(null);
                  setBase(value);
                }}
                onOverrideChange={(platform, value) => {
                  setReceipt(null);
                  setOverrides((current) => ({ ...current, [platform]: value }));
                }}
                onOverrideReset={(platform) =>
                  setOverrides((current) => {
                    const next = { ...current };
                    delete next[platform];
                    return next;
                  })
                }
              />

              <PostSettings
                targets={targets}
                format={format}
                onFormatChange={(value) => {
                  setReceipt(null);
                  setFormat(value);
                }}
                videoSeconds={videoSeconds}
                onVideoSecondsChange={setVideoSeconds}
                category={category}
                onCategoryChange={setCategory}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle>Media</CardTitle>
                <CardDescription>
                  {media.length === 0
                    ? "No attachments"
                    : `${media.length} attached`}
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <MediaDropzone
                items={media}
                onAdd={addMedia}
                onRemove={removeMedia}
              />
            </CardBody>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  How it lands, including where the caption gets cut.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <PreviewPanel
                targets={targets}
                platform={previewPlatform}
                onPlatformChange={setPreviewChoice}
                body={previewPlatform ? captionFor(previewPlatform) : ""}
                media={media}
                format={format}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle>Checks</CardTitle>
                <CardDescription>
                  Platform limits and reach hazards
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <ValidationPanel targets={targets} issues={issues} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>{timeZone}</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <SchedulePanel
                now={now}
                timeZone={timeZone}
                slots={DEFAULT_SLOTS}
                mode={mode}
                onModeChange={(value) => {
                  setReceipt(null);
                  setMode(value);
                }}
                at={at}
                onAtChange={setAt}
                blocked={blocked}
                targetCount={targets.length}
                onSubmit={submit}
                receipt={receipt}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
