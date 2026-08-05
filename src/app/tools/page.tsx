import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChannelIcon } from "@/components/channel-icon";
import { JsonLd } from "@/components/json-ld";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { Card } from "@/components/ui/card";
import { buildGraph } from "@/lib/schema";
import { TOOL_PAGES } from "@/lib/tools/repurpose-data";

export const metadata: Metadata = {
  title: "Free creator tools — repurpose your own videos everywhere",
  description:
    "Free tools to get more from the videos you already made: turn one TikTok, Reel, Short or Facebook video into a week of native posts across every network.",
  alternates: { canonical: "/tools" },
};

const UPDATED = "2026-08-05";

export default function ToolsIndexPage() {
  return (
    <>
      <JsonLd
        data={buildGraph({
          path: "/tools",
          title: "Free creator tools — repurpose your own videos",
          description:
            "Free repurposing tools for creators: turn one video into a week of native posts across every network.",
          updated: UPDATED,
          includeApp: true,
          breadcrumbs: [
            { name: "Home", path: "/" },
            { name: "Free tools", path: "/tools" },
          ],
        })}
      />

      <MarketingHeader />

      <main id="main">
        <section className="relative overflow-hidden border-b border-line">
          <div aria-hidden className="grid-field pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative mx-auto w-full max-w-3xl px-5 py-16 text-center">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-signal uppercase">
              Free tools
            </p>
            <h1 className="mt-4 font-display text-[clamp(1.9rem,4.5vw,3rem)] leading-[1.04] font-extrabold text-balance">
              Get ten times the reach from the videos you already made.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-muted">
              Free repurposing tools for creators. Pick the network your video is
              on, generate native captions in seconds, and turn one clip into a
              week of posts everywhere else.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 py-14">
          <div className="grid gap-4 sm:grid-cols-2">
            {TOOL_PAGES.map((page) => (
              <Card key={page.slug} className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <ChannelIcon platform={page.platform} size="lg" />
                  <h2 className="text-[16px] font-semibold">{page.platformName}</h2>
                </div>
                <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-muted">
                  {page.subhead}
                </p>
                <Link
                  href={`/tools/${page.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-signal hover:underline"
                >
                  Open the {page.platformName} tool
                  <ArrowRight className="size-4" />
                </Link>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
