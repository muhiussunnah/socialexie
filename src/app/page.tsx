import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { buildGraph } from "@/lib/schema";
import { PUBLIC_ROUTES } from "@/lib/public-routes";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import {
  AutomationSection,
  Features,
  StudioSection,
} from "@/components/marketing/sections";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { Button } from "@/components/ui/button";

const route = PUBLIC_ROUTES[0];

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={buildGraph({
          path: "/",
          title: route.title,
          description: route.summary,
          updated: route.updated,
          includeApp: true,
        })}
      />
      <MarketingHeader />
      <main id="main">
        <Hero />
        <Features />
        <StudioSection />
        <AutomationSection />
        <Pricing />
        <Faq />

        <section className="border-t border-line py-20">
          <div className="mx-auto w-full max-w-3xl px-5 text-center">
            <h2 className="font-display text-[clamp(1.75rem,3.6vw,2.5rem)] font-bold">
              Put the busywork on rails
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[15.5px] leading-relaxed text-muted">
              Connect two channels free, queue a week of content, and see what
              the desk feels like before you pay anything.
            </p>
            <Button asChild size="lg" className="mt-7">
              <Link href="/signup">
                Start free <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
