"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  Trash2,
} from "lucide-react";
import {
  disconnectConnectionAction,
  saveConnectionAction,
  testConnectionAction,
} from "@/app/(app)/dashboard/connections/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Label, Select } from "@/components/ui/field";
import type {
  ConnectionStatus,
  ConnectionView,
  ProviderKind,
} from "@/lib/ai/connections";
import { cn } from "@/lib/utils";

type Feedback = { tone: "ok" | "error"; text: string } | null;

const KIND_LABEL: Record<ProviderKind, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
};

function maskFromKey(key: string): string {
  return `••••••••${key.slice(-4)}`;
}

function StatusPill({
  status,
  hasKey,
  platformManaged,
}: {
  status: ConnectionStatus;
  hasKey: boolean;
  platformManaged: boolean;
}) {
  if (hasKey && status === "connected") {
    return (
      <Badge tone="ok">
        <CheckCircle2 className="size-3" aria-hidden /> Connected
      </Badge>
    );
  }
  if (hasKey && status === "error") {
    return <Badge tone="danger">Connection error</Badge>;
  }
  if (hasKey) {
    return <Badge tone="warn">Not tested</Badge>;
  }
  if (platformManaged) {
    return <Badge tone="info">Platform default</Badge>;
  }
  return <Badge tone="neutral">Not connected</Badge>;
}

export function ProviderCard({ connection }: { connection: ConnectionView }) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();
  const [removing, startRemoving] = useTransition();

  const [keyInput, setKeyInput] = useState("");
  const [reveal, setReveal] = useState(false);
  const [enabled, setEnabled] = useState(connection.enabled);
  const [textModel, setTextModel] = useState(connection.defaultTextModel ?? "");
  const [imageModel, setImageModel] = useState(
    connection.defaultImageModel ?? "",
  );
  const [videoModel, setVideoModel] = useState(
    connection.defaultVideoModel ?? "",
  );

  const [status, setStatus] = useState<ConnectionStatus>(connection.status);
  const [hasKey, setHasKey] = useState(connection.hasKey);
  const [keyPreview, setKeyPreview] = useState(connection.keyPreview);
  const [lastTested, setLastTested] = useState(connection.lastTestedAt);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const busy = saving || testing || removing;

  function onSave() {
    setFeedback(null);
    const typedKey = keyInput.trim();
    startSaving(async () => {
      const result = await saveConnectionAction({
        provider: connection.id,
        apiKey: typedKey || undefined,
        enabled,
        defaultTextModel: textModel || null,
        defaultImageModel: imageModel || null,
        defaultVideoModel: videoModel || null,
      });
      if (result.ok) {
        if (typedKey) {
          setHasKey(true);
          setKeyPreview(maskFromKey(typedKey));
          setStatus("not_tested");
          setLastTested(null);
          setKeyInput("");
          setReveal(false);
        }
        setFeedback({ tone: "ok", text: "Saved." });
        router.refresh();
      } else {
        setFeedback({ tone: "error", text: result.error });
      }
    });
  }

  function onTest() {
    setFeedback(null);
    startTesting(async () => {
      const result = await testConnectionAction(connection.id);
      if (result.ok) {
        setStatus("connected");
        setLastTested(new Date().toISOString());
        setFeedback({ tone: "ok", text: "Connection verified." });
      } else {
        setStatus("error");
        setFeedback({ tone: "error", text: result.error });
      }
      router.refresh();
    });
  }

  function onDisconnect() {
    setFeedback(null);
    startRemoving(async () => {
      const result = await disconnectConnectionAction(connection.id);
      if (result.ok) {
        setHasKey(false);
        setKeyPreview(null);
        setStatus("not_tested");
        setLastTested(null);
        setEnabled(true);
        setKeyInput("");
        setFeedback({ tone: "ok", text: "Disconnected." });
        router.refresh();
      } else {
        setFeedback({ tone: "error", text: result.error });
      }
    });
  }

  const dimmed = hasKey && !enabled;

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg text-[13px] font-bold",
            dimmed
              ? "bg-surface-3 text-subtle"
              : "bg-signal-soft text-signal",
          )}
          aria-hidden
        >
          {connection.label.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold">{connection.label}</h3>
            <span className="text-[12px] text-subtle">{connection.vendor}</span>
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            {connection.tagline}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {connection.kinds.map((kind) => (
              <span
                key={kind}
                className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium tracking-wide text-muted uppercase"
              >
                {KIND_LABEL[kind]}
              </span>
            ))}
          </div>
        </div>
        <StatusPill
          status={status}
          hasKey={hasKey}
          platformManaged={connection.platformManaged}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">API key</Label>
            <a
              href={connection.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-signal hover:underline"
            >
              Get a key · {connection.keyUrlLabel}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
          <div className="relative">
            <Input
              type={reveal ? "text" : "password"}
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder={
                hasKey
                  ? `${keyPreview ?? "Saved"} · paste a new key to replace`
                  : connection.keyHint
              }
              autoComplete="off"
              spellCheck={false}
              className="pr-10 font-mono text-[13px]"
            />
            <button
              type="button"
              onClick={() => setReveal((value) => !value)}
              aria-label={reveal ? "Hide key" : "Show key"}
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-subtle transition-colors hover:text-fg"
            >
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[12px] text-subtle">
            Stored encrypted and used only for your workspace. It never leaves the
            server or appears in the browser.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {connection.textModels.length > 0 ? (
            <Field label="Default text model">
              <Select
                value={textModel}
                onChange={(event) => setTextModel(event.target.value)}
                className="h-10 text-[13px]"
              >
                <option value="">Auto — cheapest available</option>
                {connection.textModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {connection.imageModels.length > 0 ? (
            <Field label="Default image model">
              <Select
                value={imageModel}
                onChange={(event) => setImageModel(event.target.value)}
                className="h-10 text-[13px]"
              >
                <option value="">Auto — cheapest available</option>
                {connection.imageModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {connection.videoModels.length > 0 ? (
            <Field label="Default video model">
              <Select
                value={videoModel}
                onChange={(event) => setVideoModel(event.target.value)}
                className="h-10 text-[13px]"
              >
                <option value="">Auto — cheapest available</option>
                {connection.videoModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((value) => !value)}
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-line-strong"
        >
          <span>
            <span className="block text-[13px] font-medium">
              Use this provider
            </span>
            <span className="block text-[12px] text-subtle">
              {enabled
                ? "On — routed into generation for your workspace."
                : "Off — your key stays saved but is skipped."}
            </span>
          </span>
          <span
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
              enabled ? "bg-signal" : "bg-surface-3",
            )}
          >
            <span
              className={cn(
                "inline-block size-4 rounded-full bg-white transition-transform",
                enabled ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onSave} disabled={busy}>
          {saving ? <Loader2 className="animate-spin" /> : <Plug />}
          Save
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onTest}
          disabled={busy || !hasKey}
        >
          {testing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Test connection
        </Button>
        {hasKey ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDisconnect}
            disabled={busy}
            className="ml-auto text-danger hover:text-danger"
          >
            {removing ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Disconnect
          </Button>
        ) : null}
      </div>

      {feedback ? (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={cn(
            "mt-3 text-[12.5px]",
            feedback.tone === "error" ? "text-danger" : "text-ok",
          )}
        >
          {feedback.text}
        </p>
      ) : lastTested ? (
        <p className="mt-3 text-[12px] text-subtle">
          Last tested {new Date(lastTested).toLocaleString()}
        </p>
      ) : null}
    </Card>
  );
}
