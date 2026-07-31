"use client";

import { useEffect, useRef, useState } from "react";
import { compactNumber } from "@/lib/utils";

/**
 * Counts up to `value` the first time it is seen.
 *
 * Driven by requestAnimationFrame rather than a timer so it stays in step with
 * the compositor, and it renders the final value on the server so the number is
 * correct even if the animation never runs.
 */
export function Counter({
  value,
  compact = false,
  suffix = "",
  duration = 1400,
  className,
}: {
  value: number;
  compact?: boolean;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // Ease-out cubic: fast first, settles gently on the real number.
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(value * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        setDisplay(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {compact ? compactNumber(display) : display.toLocaleString()}
      {suffix}
    </span>
  );
}
