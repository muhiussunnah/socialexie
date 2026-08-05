"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import type { PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

interface Variant {
  text: string;
  characters: number;
}

const TONES = [
  "Warm and honest",
  "Punchy and bold",
  "Funny and light",
  "Helpful and clear",
  "Emotional and heartfelt",
];

/**
 * The repurpose tool that sits inside every platform page.
 *
 * It turns one idea from a video the creator already made into caption and hook
 * variants shaped for the platform, then points them at the composer to
 * schedule it everywhere. Generation runs on the signed-in workspace's own AI
 * key through /api/ai/text; signed-out visitors get the same UI with a sign-up
 * call to action instead of a live run, so the page still converts.
 */
export function RepurposeTool({
  platform,
  platformName,
  isLoggedIn,
}: {
  platform: PlatformId;
  platformName: string;
  isLoggedIn: boolean;
}) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  async function generate() {
    setError(null);
    const prompt = topic.trim();
    if (!prompt) {
      setError("Tell it what your video is about first.");
      return;
    }
    if (!isLoggedIn) {
      setError("Create a free account to generate — it takes a few seconds.");
      return;
    }

    setLoading(true);
    setVariants([]);
    try {
      const response = await fetch("/api/ai/text", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: `Repurpose this video into native ${platformName} captions: ${prompt}`,
          platform,
          tone,
          count: 5,
        }),
      });
      const payload = (await response.json()) as
        | { ok: true; data: { variants: Variant[] } }
        | { ok: false; error: string };

      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setVariants(payload.data.variants);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      setTimeout(() => setCopied((c) => (c === index ? null : c)), 1600);
    } catch {
      // Clipboard blocked — the text stays selectable, so not a dead end.
    }
  }

  return (
    <div className="rounded-card border border-line bg-surface shadow-e1">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
        <span className="grid size-8 place-items-center rounded-lg bg-signal-soft text-signal">
          <Wand2 className="size-4" />
        </span>
        <div>
          <h3 className="text-[15px] leading-tight font-semibold">
            {platformName} caption &amp; hook generator
          </h3>
          <p className="text-[12.5px] text-muted">
            Paste what your video is about — get five native {platformName} options.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <Field label="What's the video about?">
          <Textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            rows={3}
            placeholder={`e.g. a dad and toddler playing football in the garden — "they stop asking you to play"`}
            className="text-[13.5px]"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Voice">
            <Select
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className="h-10 text-[13px]"
            >
              {TONES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Button onClick={generate} disabled={loading} className="h-10">
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? "Writing…" : "Generate captions"}
          </Button>
        </div>

        {error ? (
          <p role="alert" className="text-[12.5px] text-danger">
            {error}
          </p>
        ) : null}

        {variants.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {variants.map((variant, index) => (
              <li
                key={index}
                className="rounded-lg border border-line bg-surface-2 p-3.5"
              >
                <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">
                  {variant.text}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-subtle tabular">
                    {variant.characters} chars
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(index, variant.text)}
                    className="flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-fg"
                  >
                    {copied === index ? (
                      <Check className="size-3.5 text-ok" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copied === index ? "Copied" : "Copy"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-signal-line bg-signal-soft px-4 py-3",
            variants.length > 0 ? "" : "mt-1",
          )}
        >
          <p className="text-[12.5px] text-muted">
            {isLoggedIn
              ? "Happy with one? Drop it into the composer and schedule it to every network."
              : "Free forever on two channels — repurpose one video into a week of posts."}
          </p>
          <Button asChild size="sm">
            <Link href={isLoggedIn ? "/dashboard/composer" : "/signup"}>
              {isLoggedIn ? "Open composer" : "Start free"}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
