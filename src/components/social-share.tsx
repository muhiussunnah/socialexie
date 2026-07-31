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
    id: "facebook",
    label: "Share on Facebook",
    href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    hex: "#1877F2",
    glyph: "f",
  },
  {
    id: "whatsapp",
    label: "Share on WhatsApp",
    href: (u, t) => `https://wa.me/?text=${t}%20${u}`,
    hex: "#25D366",
    glyph: "w",
  },
  {
    id: "telegram",
    label: "Share on Telegram",
    href: (u, t) => `https://t.me/share/url?url=${u}&text=${t}`,
    hex: "#229ED9",
    glyph: "tg",
  },
  {
    id: "linkedin",
    label: "Share on LinkedIn",
    href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    hex: "#0A66C2",
    glyph: "in",
  },
  {
    id: "x",
    label: "Share on X",
    href: (u, t) => `https://x.com/intent/tweet?url=${u}&text=${t}`,
    hex: "#6D7580",
    glyph: "X",
  },
];

/**
 * Share rail pinned to the left edge.
 *
 * Collapsed it is a single tab; opening slides the column out and clicking the
 * tab again puts it away. On touch devices the first tap hands off to the
 * operating system's own share sheet, which is always better than a bespoke
 * menu on a phone.
 */
export function SocialShare() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
    // Desktop Chrome exposes navigator.share too, but the OS sheet there is a
    // worse experience than this rail — so hand off only on touch pointers.
    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    if (!open && isTouch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: document.title, url: window.location.href });
        return;
      } catch {
        // Cancelled or unsupported — fall through and open the rail.
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
    <div
      ref={rootRef}
      className="fixed top-1/2 left-0 z-40 flex -translate-y-1/2 items-start"
    >
      {/* Sliding column */}
      {/* Driven by inline style rather than class swapping: the open/closed
          transform is the one thing here that must not lose to any other rule. */}
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-r-2xl border border-l-0 border-line",
          "bg-surface/95 p-2.5 shadow-e3 backdrop-blur-xl",
          "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        )}
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
      >
        <span className="pb-0.5 text-[9.5px] font-semibold tracking-[0.12em] text-subtle uppercase">
          Share
        </span>

        {TARGETS.map((target, i) => (
          <button
            key={target.id}
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => openTarget(target)}
            aria-label={target.label}
            title={target.label}
            className="grid size-9 place-items-center rounded-xl border font-display text-[12px] font-bold lowercase transition-transform duration-200 hover:scale-110"
            style={{
              color: target.hex,
              backgroundColor: `color-mix(in srgb, ${target.hex} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${target.hex} 34%, transparent)`,
              // Staggered so the column unfurls rather than appearing at once.
              transitionDelay: open ? `${60 + i * 35}ms` : "0ms",
            }}
          >
            {target.glyph}
          </button>
        ))}

        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={copyLink}
          aria-label={copied ? "Link copied" : "Copy link"}
          title={copied ? "Link copied" : "Copy link"}
          className={cn(
            "grid size-9 place-items-center rounded-xl border transition-colors",
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

      {/* Tab — the only thing visible when closed */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "Close share menu" : "Share this page"}
        className={cn(
          "grid h-12 w-9 place-items-center rounded-r-xl border border-l-0 shadow-e2",
          "transition-colors duration-300",
          open
            ? "border-signal bg-signal text-signal-fg"
            : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-fg",
        )}
      >
        {open ? (
          <X className="size-4" aria-hidden />
        ) : (
          <Share2 className="size-4" aria-hidden />
        )}
      </button>

      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
