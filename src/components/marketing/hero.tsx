import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Atmosphere } from "@/components/marketing/atmosphere";
import { LiveConsole } from "@/components/marketing/live-console";
import { ChannelIcon } from "@/components/channel-icon";
import { Reveal, WordReveal } from "@/components/motion/reveal";
import { Tilt } from "@/components/motion/tilt";
import { Button } from "@/components/ui/button";
import { PLATFORM_LIST } from "@/lib/platforms";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <Atmosphere />

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-16 pb-14 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-word [animation-delay:80ms]">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-[12px] text-muted shadow-e1 backdrop-blur">
              <span className="relative flex size-1.5">
                <span className="animate-ring absolute inset-0 rounded-full bg-live" />
                <span className="relative size-1.5 rounded-full bg-live" />
              </span>
              Eight networks, one queue, zero tab-switching
            </span>
          </div>

          <h1 className="mt-7 font-display text-[clamp(2.6rem,7vw,4.9rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">
            <WordReveal text="Run every channel" startDelay={180} />
            <br />
            {/*
              This line animates as one block rather than word by word.
              `background-clip: text` cannot paint through descendants that
              carry their own blur and transform, so per-word animation and a
              phrase-wide gradient are mutually exclusive — the gradient is the
              more valuable of the two here.
            */}
            <span
              className="animate-word text-gradient inline-block"
              style={{ animationDelay: "420ms" }}
            >
              from one desk.
            </span>
          </h1>

          <Reveal delay={620}>
            <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
              Socialexie plans, generates and publishes across every major
              network — with an AI image studio, evergreen recycling and
              comment-to-DM flows that stay inside the platforms&apos; rules.
            </p>
          </Reveal>

          <Reveal delay={720}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="group relative overflow-hidden shadow-signal"
              >
                <Link href="/signup">
                  {/* Light sweeps across the button on hover. */}
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  />
                  Start free
                  <ArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </Button>

              <Button asChild size="lg" variant="outline" className="group backdrop-blur">
                <Link href="#features">
                  <Play className="transition-transform duration-300 group-hover:scale-110" />
                  See how it works
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-[12.5px] text-subtle">
              No card required · 2 channels free forever · Bring your existing
              queue in one CSV
            </p>
          </Reveal>
        </div>

        {/* The product, reclined into the page rather than pasted on it. */}
        <Reveal delay={200} className="mt-14">
          <Tilt>
            <LiveConsole />
          </Tilt>
        </Reveal>

        {/* Channel marquee — duplicated once so the loop is seamless. */}
        <Reveal delay={120} className="mt-14">
          <div
            className="relative overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
            }}
          >
            <div className="animate-marquee flex w-max gap-3 motion-reduce:animate-none">
              {[...PLATFORM_LIST, ...PLATFORM_LIST].map((platform, index) => (
                <span
                  key={`${platform.id}-${index}`}
                  className="flex shrink-0 items-center gap-2.5 rounded-full border border-line bg-surface/60 px-4 py-2 backdrop-blur"
                >
                  <ChannelIcon platform={platform.id} size="sm" />
                  <span className="text-[13px] whitespace-nowrap text-muted">
                    {platform.name}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
