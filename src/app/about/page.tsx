import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChannelIcon } from "@/components/channel-icon";
import { PLATFORM_LIST } from "@/lib/platforms";
import { PUBLIC_ROUTES } from "@/lib/public-routes";
import { buildGraph } from "@/lib/schema";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Socialexie exists: one desk for every social channel, built to grow an audience without the tactics that quietly cost you reach.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    title: "Reach you keep beats engagement you rent",
    body: "Asking people to comment a keyword spikes a post's numbers and quietly stops it reaching anyone new. Socialexie flags that pattern in the composer instead of selling it as a growth hack, and puts shares, saves and watch time ahead of likes in analytics — because those are the signals that actually widen an audience.",
  },
  {
    title: "Guardrails belong in the product, not the docs",
    body: "Automated messages are held to the 24-hour window a person opens by contacting you, capped at one per person per day by a database constraint rather than a policy page, and paced so a spike in comments never reads as a bot flooding a thread.",
  },
  {
    title: "Official APIs, always",
    body: "Every channel connects through its own OAuth flow. No password sharing, no browser automation, no unofficial endpoints — the shortcuts that get accounts restricted are not worth the features they unlock.",
  },
  {
    title: "Your content stays yours",
    body: "Workspace data is isolated in the database itself with row-level security, not just in application code. We do not sell your data, share it with advertisers, or use your content to train models.",
  },
];

export default function AboutPage() {
  const route = PUBLIC_ROUTES.find((r) => r.path === "/about");

  return (
    <>
      {route ? (
        <JsonLd
          data={buildGraph({
            path: "/about",
            title: route.title,
            description: route.summary,
            updated: route.updated,
            includeApp: true,
            breadcrumbs: [
              { name: "Home", path: "/" },
              { name: "About", path: "/about" },
            ],
          })}
        />
      ) : null}

      <MarketingHeader />

      <main id="main">
        <section className="relative overflow-hidden border-b border-line">
          <div aria-hidden className="grid-field pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative mx-auto w-full max-w-3xl px-5 py-20 text-center">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-signal uppercase">
              About
            </p>
            <h1 className="mt-4 font-display text-[clamp(2rem,5vw,3.25rem)] leading-[1.02] font-extrabold">
              Publishing everywhere should not cost you a whole week.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[16.5px] leading-relaxed text-muted">
              Socialexie started from a boring, repetitive problem: writing one
              good post, then rebuilding it eight times because every network
              wants a different caption length, crop and format — and then doing
              the whole thing again next week.
            </p>
          </div>
        </section>

        <section className="border-b border-line py-16">
          <div className="mx-auto w-full max-w-3xl px-5">
            <h2 className="font-display text-[24px] font-bold">What we build</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted">
              One desk that plans, generates and publishes across every major
              network. You write once; the app shapes it per channel, checks it
              against each platform&apos;s real limits before it can be
              scheduled, and sends it out on a timezone-aware queue. An AI studio
              handles the images and captions, evergreen rules put your best work
              back into rotation, and analytics tell you which posts actually
              travelled.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {PLATFORM_LIST.map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2"
                >
                  <ChannelIcon platform={p.id} size="sm" />
                  <span className="text-[12.5px] text-muted">{p.name}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-line py-16">
          <div className="mx-auto w-full max-w-4xl px-5">
            <h2 className="font-display text-[24px] font-bold">
              What we will not do
            </h2>
            <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-muted">
              Most of the decisions in this product are about what we left out.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {PRINCIPLES.map((item) => (
                <Card key={item.title} className="p-5">
                  <h3 className="text-[15px] font-semibold">{item.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                    {item.body}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto w-full max-w-3xl px-5">
            <Card className="border-signal-line bg-signal-soft p-6">
              <h2 className="font-display text-[19px] font-bold">
                One thing we are honest about
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
                No tool can promise you reach. Socialexie removes the busywork
                and keeps you on the right side of the platforms&apos; rules —
                the content still has to be worth watching. Any product that
                sells you a follower number is selling you the part it
                cannot control.
              </p>
            </Card>

            <div className="mt-10 text-center">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start free <ArrowRight />
                </Link>
              </Button>
              <p className="mt-3 text-[12.5px] text-subtle">
                Two channels free forever · No card required
              </p>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
