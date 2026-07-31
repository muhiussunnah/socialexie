"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Gives a panel a sense of physical placement: it sits slightly reclined, and
 * leans toward the pointer.
 *
 * Writes CSS custom properties on pointermove and lets a CSS transition do the
 * interpolation, so React never re-renders while the pointer moves — the whole
 * effect stays on the compositor.
 */
export function Tilt({
  children,
  className,
  /** Degrees of lean at the edges. */
  max = 5,
  /** Resting recline, so it reads as a surface even before interaction. */
  rest = 3,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  rest?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const rect = node.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;

    node.style.setProperty("--tilt-x", `${(-py * max).toFixed(2)}deg`);
    node.style.setProperty("--tilt-y", `${(px * max).toFixed(2)}deg`);
    node.style.setProperty("--glare-x", `${((px + 0.5) * 100).toFixed(1)}%`);
    node.style.setProperty("--glare-y", `${((py + 0.5) * 100).toFixed(1)}%`);
  }

  function onLeave() {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--tilt-x", `${rest}deg`);
    node.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div style={{ perspective: "1600px" }} className={className}>
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className={cn(
          "relative transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "motion-reduce:!transform-none",
        )}
        style={{
          transformStyle: "preserve-3d",
          // Falls back to the resting recline before the first pointer event.
          transform:
            "rotateX(var(--tilt-x, 3deg)) rotateY(var(--tilt-y, 0deg))",
        }}
      >
        {children}
      </div>
    </div>
  );
}
