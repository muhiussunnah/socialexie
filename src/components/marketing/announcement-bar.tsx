"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowRight, X, Zap } from "lucide-react";

export const ANNOUNCEMENT_ID = "lifetime-2026";
const STORAGE_KEY = `socialexie-dismissed-${ANNOUNCEMENT_ID}`;

/**
 * Runs before paint. The bar is rendered server-side and this hides it
 * synchronously when it was already dismissed, so a returning visitor never
 * sees it flash in and shift the page — dismissal must not cost us CLS.
 */
export const announcementInitScript = `
(function(){
  try {
    if (localStorage.getItem(${JSON.stringify(STORAGE_KEY)})) {
      document.documentElement.classList.add("announce-hidden");
    }
  } catch (e) {}
})();
`.trim();

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage can be denied; hiding for this session is still correct.
    }
    document.documentElement.classList.add("announce-hidden");
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <div
      data-announce
      className="relative isolate overflow-hidden border-b border-signal-line bg-signal text-signal-fg"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-3 px-10 py-2.5 text-center sm:px-5">
        <span className="hidden items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-1 text-[10.5px] font-bold tracking-[0.1em] uppercase sm:inline-flex">
          <Zap className="size-3" aria-hidden />
          Lifetime deal
        </span>

        <p className="text-[13px] font-medium">
          Pay once, own it forever — lifetime plans never renew.
        </p>

        <Link
          href="/pricing"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/15 px-3 py-1 text-[12.5px] font-semibold transition-colors hover:bg-black/25"
        >
          See pricing
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full transition-colors hover:bg-black/20"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
