"use client";

import { useState } from "react";
import { CornerDownRight, Plus, X } from "lucide-react";
import type { Automation } from "@/components/automations/compliance-panel";
import { ChannelIcon } from "@/components/channel-icon";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/field";
import { demoChannels } from "@/lib/demo";
import { getPlatform } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const MAX_REPLIES = 6;

const FLOW = [
  "Comment matches",
  "Public reply",
  "Opt-in DM",
  "Payload DM",
] as const;

export function AutomationForm({
  draft,
  onChange,
  onSave,
  onCancel,
  canSave,
  isNew,
}: {
  draft: Automation;
  onChange: (patch: Partial<Automation>) => void;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
  isNew: boolean;
}) {
  const [keywordDraft, setKeywordDraft] = useState("");

  function addKeyword() {
    const keyword = keywordDraft.trim().toUpperCase();
    if (keyword.length === 0) return;
    if (draft.keywords.some((word) => word.toUpperCase() === keyword)) {
      setKeywordDraft("");
      return;
    }
    onChange({ keywords: [...draft.keywords, keyword] });
    setKeywordDraft("");
  }

  function setReply(index: number, value: string) {
    onChange({
      replies: draft.replies.map((reply, i) => (i === index ? value : reply)),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap items-center gap-1.5">
        {FLOW.map((step, index) => (
          <li key={step} className="flex items-center gap-1.5">
            {index > 0 ? (
              <CornerDownRight className="size-3 text-subtle" />
            ) : null}
            <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] text-muted">
              <span className="font-mono text-subtle">{index + 1}</span> {step}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2">
        <Label>Channel</Label>
        <div className="flex flex-wrap gap-2">
          {demoChannels.map((channel) => {
            const spec = getPlatform(channel.platform);
            const supported = spec.supportsCommentAutomation;
            const active = draft.channel === channel.platform;

            return (
              <button
                key={channel.id}
                type="button"
                disabled={!supported}
                aria-pressed={active}
                onClick={() => onChange({ channel: channel.platform })}
                title={
                  supported
                    ? spec.name
                    : `${spec.name} has no comment-automation API`
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors",
                  active
                    ? "border-signal bg-signal-soft font-medium text-signal"
                    : "border-line bg-surface-2 hover:border-line-strong",
                  !supported && "cursor-not-allowed opacity-45",
                )}
              >
                <ChannelIcon platform={channel.platform} size="sm" />
                {spec.name}
              </button>
            );
          })}
        </div>
        <p className="text-[11.5px] text-subtle">
          Only Instagram and Facebook expose a comment-automation API. Anything
          else would mean driving a logged-in session, which is what gets
          accounts restricted.
        </p>
      </div>

      <Field label="Name" hint="Only you see this">
        <Input
          value={draft.name}
          placeholder="Bedtime one-pager"
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Label>Trigger words</Label>
        <div className="flex flex-wrap gap-1.5">
          {draft.keywords.map((keyword) => (
            <span
              key={keyword}
              className="flex items-center gap-1.5 rounded-full bg-surface-3 py-1 pr-1.5 pl-2.5 font-mono text-[11.5px]"
            >
              {keyword}
              <button
                type="button"
                onClick={() =>
                  onChange({
                    keywords: draft.keywords.filter((word) => word !== keyword),
                  })
                }
                aria-label={`Remove ${keyword}`}
                className="text-subtle transition-colors hover:text-danger"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Input
            value={keywordDraft}
            placeholder="BEDTIME"
            onChange={(event) => setKeywordDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addKeyword();
              }
            }}
            className="h-9 flex-1"
          />
          <Button variant="secondary" size="sm" onClick={addKeyword} className="h-9">
            <Plus />
            Add
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Public replies</Label>
          <span className="text-[11px] text-subtle">
            {draft.replies.length} of {MAX_REPLIES} · rotated
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {draft.replies.map((reply, index) => (
            <div key={index} className="flex gap-1.5">
              <Input
                value={reply}
                placeholder={`Variation ${index + 1}`}
                onChange={(event) => setReply(index, event.target.value)}
              />
              {draft.replies.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      replies: draft.replies.filter((_, i) => i !== index),
                    })
                  }
                  aria-label={`Remove variation ${index + 1}`}
                  className="rounded-lg px-2 text-subtle transition-colors hover:bg-surface-2 hover:text-danger"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {draft.replies.length < MAX_REPLIES ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ replies: [...draft.replies, ""] })}
            className="self-start px-2"
          >
            <Plus />
            Add variation
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field
          label="Opt-in message"
          hint="Sent first. Nothing else goes out until they tap the button."
        >
          <Textarea
            value={draft.optInMessage}
            rows={3}
            placeholder="Happy to send it over. Want it here?"
            onChange={(event) => onChange({ optInMessage: event.target.value })}
          />
        </Field>
        <Field label="Button label" hint="Keep it short">
          <Input
            value={draft.optInButton}
            placeholder="Send it over"
            onChange={(event) => onChange({ optInButton: event.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <Field label="Payload message" hint="Sent after they opt in">
          <Textarea
            value={draft.payloadMessage}
            rows={3}
            placeholder="Here it is — the one-page version."
            onChange={(event) =>
              onChange({ payloadMessage: event.target.value })
            }
          />
        </Field>
        <div className="flex flex-col gap-4">
          <Field label="Link" hint="https only">
            <Input
              value={draft.payloadLink}
              placeholder="https://"
              inputMode="url"
              onChange={(event) => onChange({ payloadLink: event.target.value })}
            />
          </Field>
          <Field label="Daily cap" hint="Sends, then it stops">
            <Input
              type="number"
              min={1}
              step={10}
              inputMode="numeric"
              value={String(draft.dailyCap)}
              onChange={(event) =>
                onChange({ dailyCap: Number(event.target.value) || 0 })
              }
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line pt-4">
        <Button onClick={onSave} disabled={!canSave}>
          {isNew ? "Create automation" : "Save changes"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {!canSave ? (
          <p className="text-[12px] text-warn">
            Compliance checks on the right have to pass first.
          </p>
        ) : null}
      </div>
    </div>
  );
}
