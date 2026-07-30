"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Target {
  id: string;
  label: string;
  /** Built from the live URL at click time, never at render. */
  href: (url: string, title: string) => string;
  hex: string;
  glyph: string;
}

const TARGETS: readonly Target[] = [
  {
    id: "x",
    label: "Share on X",
    href: (u, t) => `https://x.com/intent/tweet?url=${u}&text=${t}`,
    hex: "#6D7580",
    glyph: "X",
  },
  {
    id: "facebook",
    label: "Share on Facebook",
    href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    hex: "#1877F2",
    glyph: "f",
  },
  {
    id: "linkedin",
    label: "Share on LinkedIn",
    href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    hex: "#0A66C2",
    glyph: "in",
  },
  {
    id: "whatsapp",
    label: "Share on WhatsApp",
    href: (u, t) => `https://wa.me/?text=${t}%20${u}`,
    hex: "#25D366",
    glyph: "w",
  },
];

export function SocialShare() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape, the two things people expect.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function onToggle() {
    const url = window.location.href;
    const title = document.title;

    // On phones the OS sheet is strictly better than our own menu.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled or unavailable — fall through to the menu.
      }
    }
    setOpen((v) => !v);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function openTarget(target: Target) {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    window.open(target.href(url, title), "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="fixed bottom-5 left-5 z-40 flex flex-col-reverse items-start gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "Close share menu" : "Share this page"}
        className={cn(
          "grid size-11 place-items-center rounded-full border shadow-e2 transition-colors",
          open
            ? "border-signal bg-signal text-signal-fg"
            : "border-line bg-surface text-muted hover:border-signal hover:text-fg",
        )}
      >
        {open ? (
          <X className="size-4" aria-hidden />
        ) : (
          <Share2 className="size-4" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="flex animate-rise flex-col gap-2 rounded-panel border border-line bg-surface p-2 shadow-e3">
          {TARGETS.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => openTarget(target)}
              aria-label={target.label}
              title={target.label}
              className="grid size-9 place-items-center rounded-full border font-display text-[12px] font-bold lowercase transition-transform hover:scale-105"
              style={{
                color: target.hex,
                backgroundColor: `color-mix(in srgb, ${target.hex} 14%, transparent)`,
                borderColor: `color-mix(in srgb, ${target.hex} 34%, transparent)`,
              }}
            >
              {target.glyph}
            </button>
          ))}

          <button
            type="button"
            onClick={copyLink}
            aria-label={copied ? "Link copied" : "Copy link"}
            title={copied ? "Link copied" : "Copy link"}
            className={cn(
              "grid size-9 place-items-center rounded-full border transition-colors",
              copied
                ? "border-transparent bg-ok-soft text-ok"
                : "border-line bg-surface-2 text-muted hover:text-fg",
            )}
          >
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Link2 className="size-4" aria-hidden />
            )}
          </button>
        </div>
      ) : null}

      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
