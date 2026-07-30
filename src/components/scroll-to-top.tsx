"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Appears once the reader is far enough down that scrolling back is a chore.
 * Uses a sentinel + IntersectionObserver rather than a scroll listener so it
 * costs nothing on the main thread while scrolling — scroll handlers are a
 * common INP offender.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;top:900px;left:0;width:1px;height:1px;pointer-events:none";
    document.body.appendChild(sentinel);

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

  function toTop() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Scroll back to top"
      className={cn(
        "fixed right-5 bottom-5 z-40 grid size-11 place-items-center rounded-full",
        "border border-line bg-surface text-muted shadow-e2 backdrop-blur",
        "transition-[opacity,transform,color,border-color] duration-200",
        "hover:border-signal hover:text-fg",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp className="size-4" aria-hidden />
    </button>
  );
}
