"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { CaptionResults } from "@/components/studio/caption-results";
import { PromptPanel } from "@/components/studio/prompt-panel";
import { RecentStrip, type RecentEntry } from "@/components/studio/recent-strip";
import { ResultsGrid } from "@/components/studio/results-grid";
import { AUTO_MODEL } from "@/components/studio/model-picker";
import type { CanvasSize } from "@/components/studio/size-control";
import { Segmented } from "@/components/ui/segmented";
import type {
  ApiEnvelope,
  GeneratedImage,
  ImageResult,
  ModelOption,
  ModelSpec,
  ProviderStatus,
  TextResult,
  TextVariant,
} from "@/lib/ai/types";
import { SIZE_PRESETS, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

type Mode = "image" | "caption";

const MODES = [
  { value: "image" as const, label: "Images" },
  { value: "caption" as const, label: "Captions" },
];

const DEFAULT_PRESET = SIZE_PRESETS[1];
const RECENT_LIMIT = 14;

/** Handoff slot the composer reads on mount. */
const COMPOSER_DRAFT_KEY = "socialexie:composer-draft";

function cost(option: ModelOption): number {
  return (
    option.model.approxCentsPerImage ??
    option.model.approxCentsPerMTok ??
    Number.MAX_SAFE_INTEGER
  );
}

/** Mirrors the router: an explicit pick when it is usable, cheapest otherwise. */
function activeModel(
  options: readonly ModelOption[],
  requestedId: string,
): ModelSpec | null {
  const exact = options.find(
    (option) => option.model.id === requestedId && option.available,
  );
  if (exact) return exact.model;

  const available = options.filter((option) => option.available);
  if (available.length === 0) return null;
  return available.reduce((best, option) =>
    cost(option) < cost(best) ? option : best,
  ).model;
}

async function post<T>(
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | null;

  if (!payload) throw new Error("The studio service returned an unreadable response.");
  if (!payload.ok) throw new Error(payload.error);
  return payload.data;
}

export function Studio({
  imageModels,
  textModels,
  providers,
}: {
  imageModels: ModelOption[];
  textModels: ModelOption[];
  providers: ProviderStatus[];
}) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [imageModelId, setImageModelId] = useState(AUTO_MODEL);
  const [textModelId, setTextModelId] = useState(AUTO_MODEL);
  const [size, setSize] = useState<CanvasSize>({
    width: DEFAULT_PRESET.width,
    height: DEFAULT_PRESET.height,
    presetId: DEFAULT_PRESET.id,
  });
  const [batch, setBatch] = useState(4);
  const [variants, setVariants] = useState(3);
  const [platform, setPlatform] = useState<PlatformId | "">("instagram");

  const [imageResult, setImageResult] = useState<ImageResult | null>(null);
  const [textResult, setTextResult] = useState<TextResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  const inFlight = useRef<AbortController | null>(null);

  const isImage = mode === "image";
  const options = isImage ? imageModels : textModels;
  const modelId = isImage ? imageModelId : textModelId;
  const count = isImage ? batch : variants;

  const model = useMemo(
    () => activeModel(options, modelId),
    [options, modelId],
  );
  const simulated = model === null;

  const estimateCents = useMemo(() => {
    if (!model) return 0;
    if (isImage) return Math.round((model.approxCentsPerImage ?? 0) * batch);
    // Matches the server estimate: prompt overhead plus per-option output.
    const tokens = 700 + variants * 180;
    return Math.max(1, Math.round(((model.approxCentsPerMTok ?? 0) * tokens) / 1_000_000));
  }, [model, isImage, batch, variants]);

  const remember = useCallback((entries: RecentEntry[]) => {
    setRecent((previous) => [...entries, ...previous].slice(0, RECENT_LIMIT));
  }, []);

  const begin = useCallback(() => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setError(null);
    return controller;
  }, []);

  const generate = useCallback(async () => {
    if (prompt.trim().length === 0 || busy) return;
    const controller = begin();
    setBusy(true);
    // Clear first so the grid shows the skeleton for this batch rather than the
    // previous run's frames sitting beside it.
    if (isImage) setImageResult(null);
    else setTextResult(null);

    try {
      if (isImage) {
        const data = await post<ImageResult>(
          "/api/ai/image",
          {
            prompt,
            style: style || undefined,
            width: size.width,
            height: size.height,
            count: batch,
            modelId: imageModelId || undefined,
          },
          controller.signal,
        );
        setImageResult(data);
        remember(
          data.images.map((image, index) => ({
            id: `${Date.now()}-${index}`,
            kind: "image" as const,
            prompt,
            modelLabel: data.model.label,
            simulated: data.simulated,
            at: Date.now(),
            url: image.url,
            width: image.width,
            height: image.height,
          })),
        );
      } else {
        const data = await post<TextResult>(
          "/api/ai/text",
          {
            prompt,
            tone: style || undefined,
            platform: platform || undefined,
            count: variants,
            modelId: textModelId || undefined,
          },
          controller.signal,
        );
        setTextResult(data);
        remember(
          data.variants.slice(0, 3).map((variant, index) => ({
            id: `${Date.now()}-${index}`,
            kind: "caption" as const,
            prompt,
            modelLabel: data.model.label,
            simulated: data.simulated,
            at: Date.now(),
            excerpt: variant.text,
          })),
        );
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }, [
    batch,
    begin,
    busy,
    imageModelId,
    isImage,
    platform,
    prompt,
    remember,
    size.height,
    size.width,
    style,
    textModelId,
    variants,
  ]);

  const regenerate = useCallback(
    async (index: number) => {
      if (busy || regeneratingIndex !== null) return;
      const controller = begin();
      setRegeneratingIndex(index);

      try {
        const data = await post<ImageResult>(
          "/api/ai/image",
          {
            prompt,
            style: style || undefined,
            width: size.width,
            height: size.height,
            count: 1,
            modelId: imageModelId || undefined,
          },
          controller.signal,
        );
        const replacement = data.images[0];
        if (!replacement) return;
        setImageResult((previous) =>
          previous
            ? {
                ...previous,
                images: previous.images.map((image, position) =>
                  position === index ? replacement : image,
                ),
              }
            : data,
        );
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Regeneration failed.");
      } finally {
        setRegeneratingIndex(null);
      }
    },
    [begin, busy, imageModelId, prompt, regeneratingIndex, size.height, size.width, style],
  );

  const handoff = useCallback(
    (draft: Record<string, unknown>) => {
      try {
        sessionStorage.setItem(
          COMPOSER_DRAFT_KEY,
          JSON.stringify({ ...draft, prompt, createdAt: Date.now() }),
        );
      } catch {
        // Session storage is capped at a few megabytes and a full-resolution
        // frame can exceed it; downloading is the escape hatch.
        setError("That asset is too large to hand off. Download it instead.");
        return;
      }
      router.push("/dashboard/composer");
    },
    [prompt, router],
  );

  const sendImage = useCallback(
    (image: GeneratedImage) => {
      handoff({
        kind: "image",
        url: image.url,
        width: image.width,
        height: image.height,
        mimeType: image.mimeType,
      });
    },
    [handoff],
  );

  const sendCaption = useCallback(
    (variant: TextVariant) => {
      handoff({ kind: "caption", body: variant.text, platform: platform || null });
    },
    [handoff, platform],
  );

  const reuse = useCallback((entry: RecentEntry) => {
    setMode(entry.kind === "image" ? "image" : "caption");
    setPrompt(entry.prompt);
    if (entry.kind === "image" && entry.width && entry.height) {
      const preset = SIZE_PRESETS.find(
        (candidate) =>
          candidate.width === entry.width && candidate.height === entry.height,
      );
      setSize({
        width: entry.width,
        height: entry.height,
        presetId: preset?.id ?? null,
      });
    }
  }, []);

  const connected = providers.filter((provider) => provider.configured).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold">AI studio</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            One brief, routed to the cheapest model you have connected.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {providers.map((provider) => (
            <span
              key={provider.id}
              title={
                provider.configured
                  ? `${provider.label} is connected`
                  : `${provider.label} has no API key`
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                provider.configured
                  ? "border-ok/35 bg-ok-soft text-ok"
                  : "border-line bg-surface text-subtle",
              )}
            >
              {provider.configured ? (
                <span className="size-1.5 rounded-full bg-ok" />
              ) : (
                <KeyRound className="size-3" />
              )}
              {provider.label}
            </span>
          ))}
        </div>
      </div>

      {connected === 0 ? (
        <div className="flex items-start gap-2.5 rounded-card border border-signal-line bg-signal-soft px-4 py-3 text-[12.5px]">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-signal" />
          <p className="text-muted">
            <span className="font-medium text-fg">Simulated mode.</span> No model
            provider key is set, so every render is a clearly-labelled
            placeholder. Add one of{" "}
            <code className="font-mono">OPENROUTER_API_KEY</code>,{" "}
            <code className="font-mono">GOOGLE_AI_API_KEY</code>,{" "}
            <code className="font-mono">OPENAI_API_KEY</code> or{" "}
            <code className="font-mono">ANTHROPIC_API_KEY</code> to generate for
            real.
          </p>
        </div>
      ) : null}

      <Segmented
        name="Studio mode"
        value={mode}
        options={MODES}
        size="sm"
        onChange={(next) => {
          setMode(next);
          setError(null);
        }}
        className="self-start"
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <PromptPanel
          mode={mode}
          prompt={prompt}
          onPromptChange={setPrompt}
          style={style}
          onStyleChange={setStyle}
          modelId={modelId}
          onModelChange={isImage ? setImageModelId : setTextModelId}
          modelOptions={options}
          providers={providers}
          size={size}
          onSizeChange={setSize}
          count={count}
          onCountChange={isImage ? setBatch : setVariants}
          platform={platform}
          onPlatformChange={setPlatform}
          estimateCents={estimateCents}
          simulated={simulated}
          busy={busy}
          onGenerate={() => void generate()}
          onCancel={() => inFlight.current?.abort()}
        />

        {isImage ? (
          <ResultsGrid
            result={imageResult}
            loading={busy}
            pendingCount={batch}
            size={size}
            error={error}
            regeneratingIndex={regeneratingIndex}
            onRegenerate={(index) => void regenerate(index)}
            onSend={sendImage}
          />
        ) : (
          <CaptionResults
            result={textResult}
            loading={busy}
            pendingCount={variants}
            platform={platform || null}
            error={error}
            onSend={sendCaption}
          />
        )}
      </div>

      <RecentStrip entries={recent} onReuse={reuse} />
    </div>
  );
}
