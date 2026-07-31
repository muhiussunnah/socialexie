import { cn } from "@/lib/utils";

/**
 * The ambient layer behind a section: three slow-drifting colour halos, the
 * engineering grid, and a film grain that stops the blurred gradients banding.
 *
 * Purely decorative and entirely CSS — no canvas, no WebGL, nothing that would
 * put a frame budget on the main thread.
 */
export function Atmosphere({
  className,
  grid = true,
}: {
  className?: string;
  grid?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "grain pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div
        className="halo animate-drift"
        style={{
          top: "-18%",
          left: "-6%",
          width: "46rem",
          height: "46rem",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--signal) 62%, transparent), transparent 68%)",
        }}
      />
      <div
        className="halo animate-drift-slow"
        style={{
          top: "-10%",
          right: "-12%",
          width: "40rem",
          height: "40rem",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--halo) 55%, transparent), transparent 68%)",
        }}
      />
      <div
        className="halo animate-drift"
        style={{
          bottom: "-26%",
          left: "34%",
          width: "38rem",
          height: "38rem",
          animationDelay: "-8s",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--live) 48%, transparent), transparent 70%)",
        }}
      />

      {grid ? <div className="grid-field absolute inset-0 opacity-50" /> : null}

      {/* Fades the whole atmosphere into the section below it. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}
