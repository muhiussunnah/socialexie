import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ConsolePreview } from "@/components/marketing/console-preview";
import { Button } from "@/components/ui/button";
import { PLATFORM_LIST } from "@/lib/platforms";
import { ChannelIcon } from "@/components/channel-icon";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="grid-field pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-16 pb-12 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted shadow-e1">
            <span className="size-1.5 rounded-full bg-live" />
            Eight networks, one queue, zero tab-switching
          </span>

          <h1 className="mt-6 font-display text-[clamp(2.4rem,6.4vw,4.25rem)] leading-[0.98] font-extrabold">
            Run every channel
            <br />
            from <span className="text-signal">one desk</span>.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
            Socialexie plans, generates and publishes across every major
            network — with an AI image studio, evergreen recycling and
            comment-to-DM flows that stay inside the platforms&apos; rules.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Start free <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#features">See how it works</Link>
            </Button>
          </div>

          <p className="mt-4 text-[12.5px] text-subtle">
            No card required · 2 channels free forever · Bring your existing
            queue in one CSV
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-1.5">
            {PLATFORM_LIST.map((p) => (
              <ChannelIcon key={p.id} platform={p.id} size="md" />
            ))}
          </div>
        </div>

        <div className="mt-14 [animation-delay:120ms] animate-rise">
          <ConsolePreview />
        </div>
      </div>
    </section>
  );
}
