"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Flame, Info, Loader2, Search } from "lucide-react";
import { ChannelIcon } from "@/components/channel-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PLATFORM_LIST, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

interface ViralIdea {
  hook: string;
  format: string;
  signal: string;
  effort: string;
  why: string;
}

type SignalTone = "signal" | "live" | "info" | "warn" | "neutral";

function signalTone(signal: string): SignalTone {
  const s = signal.toLowerCase();
  if (s.includes("save")) return "signal";
  if (s.includes("share")) return "live";
  if (s.includes("comment")) return "info";
  if (s.includes("watch")) return "warn";
  return "neutral";
}

function effortTone(effort: string): "ok" | "warn" | "danger" | "neutral" {
  const e = effort.toLowerCase();
  if (e.includes("low")) return "ok";
  if (e.includes("medium")) return "warn";
  if (e.includes("high")) return "danger";
  return "neutral";
}

export function ViralFinder() {
  const [platform, setPlatform] = useState<PlatformId>("tiktok");
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<ViralIdea[]>([]);
  const [searched, setSearched] = useState<{ platform: string; niche: string } | null>(
    null,
  );
  const [copied, setCopied] = useState<number | null>(null);

  const platformName =
    PLATFORM_LIST.find((p) => p.id === platform)?.name ?? platform;

  async function find() {
    setError(null);
    const trimmed = niche.trim();
    if (trimmed.length < 2) {
      setError("Tell it your niche — e.g. gentle parenting, home coffee, indie SaaS.");
      return;
    }

    setLoading(true);
    setIdeas([]);
    try {
      const response = await fetch("/api/tools/viral-finder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform, niche: trimmed }),
      });
      const payload = (await response.json()) as
        | { ok: true; data: { ideas: ViralIdea[] } }
        | { ok: false; error: string };

      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setIdeas(payload.data.ideas);
      setSearched({ platform: platformName, niche: trimmed });
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
      // Clipboard blocked — text stays selectable.
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-signal-soft text-signal">
            <Flame className="size-4" />
          </span>
          <h1 className="font-display text-[26px] font-bold">Viral finder</h1>
        </div>
        <p className="mt-1 text-[13.5px] text-muted">
          Pick a network and a niche — see the content patterns working there
          right now, with the signal each one drives, to spark your next post.
        </p>
      </div>

      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-end">
          <Field label="Network">
            <Select
              value={platform}
              onChange={(event) => setPlatform(event.target.value as PlatformId)}
              className="h-10 text-[13px]"
            >
              {PLATFORM_LIST.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Niche or topic">
            <Input
              value={niche}
              onChange={(event) => setNiche(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") find();
              }}
              placeholder="e.g. gentle parenting, home barista, indie SaaS"
              className="h-10 text-[13px]"
            />
          </Field>
          <Button onClick={find} disabled={loading} className="h-10">
            {loading ? <Loader2 className="animate-spin" /> : <Search />}
            {loading ? "Finding…" : "Find viral ideas"}
          </Button>
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-[12.5px] text-danger">
            {error}
          </p>
        ) : null}

        <p className="mt-3 flex items-start gap-1.5 text-[12px] text-subtle">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          AI-analysed viral patterns for inspiration — idea starters, not live
          scraped posts, so there is nothing to download.
        </p>
      </Card>

      {searched && ideas.length > 0 ? (
        <div>
          <p className="mb-3 text-[13px] text-muted">
            Top angles working in{" "}
            <span className="font-medium text-fg">{searched.niche}</span> on{" "}
            <span className="font-medium text-fg">{searched.platform}</span>
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {ideas.map((idea, index) => (
              <Card key={index} className="flex flex-col p-4">
                <div className="flex items-start gap-2.5">
                  <ChannelIcon platform={platform} />
                  <p className="flex-1 text-[14.5px] leading-snug font-semibold text-balance">
                    {idea.hook}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="neutral">{idea.format}</Badge>
                  <Badge tone={signalTone(idea.signal)}>
                    Drives {idea.signal.toLowerCase()}
                  </Badge>
                  <Badge tone={effortTone(idea.effort)}>{idea.effort} effort</Badge>
                </div>

                {idea.why ? (
                  <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                    {idea.why}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/dashboard/composer">Use this idea</Link>
                  </Button>
                  <button
                    type="button"
                    onClick={() => copy(index, idea.hook)}
                    className={cn(
                      "ml-auto flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-fg",
                    )}
                  >
                    {copied === index ? (
                      <Check className="size-3.5 text-ok" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copied === index ? "Copied" : "Copy hook"}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
