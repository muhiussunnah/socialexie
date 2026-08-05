import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { ChannelIcon } from "@/components/channel-icon";
import { JsonLd } from "@/components/json-ld";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { RepurposeTool } from "@/components/tools/repurpose-tool";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { absoluteUrl } from "@/lib/public-routes";
import { buildGraph } from "@/lib/schema";
import { getToolPage, TOOL_PAGES, type ToolSection } from "@/lib/tools/repurpose-data";

export function generateStaticParams() {
  return TOOL_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getToolPage(slug);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/tools/${page.slug}` },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url: absoluteUrl(`/tools/${page.slug}`),
      type: "website",
    },
  };
}

function Section({ section }: { section: ToolSection }) {
  return (
    <div className="mt-10">
      <h2 className="font-display text-[22px] font-bold text-balance">
        {section.heading}
      </h2>
      {section.paragraphs.map((paragraph, index) => (
        <p key={index} className="mt-3 text-[15px] leading-relaxed text-muted">
          {paragraph}
        </p>
      ))}
      {section.bullets ? (
        <ul className="mt-4 flex flex-col gap-2.5">
          {section.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed">
              <Check className="mt-1 size-4 shrink-0 text-live" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default async function ToolPageView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getToolPage(slug);
  if (!page) notFound();

  const session = await getSession().catch(() => null);
  const others = TOOL_PAGES.filter((p) => p.slug !== page.slug);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${absoluteUrl(`/tools/${page.slug}`)}#faq`,
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <JsonLd
        data={buildGraph({
          path: `/tools/${page.slug}`,
          title: page.metaTitle,
          description: page.metaDescription,
          updated: page.updated,
          includeApp: true,
          breadcrumbs: [
            { name: "Home", path: "/" },
            { name: "Free tools", path: "/tools" },
            { name: page.platformName, path: `/tools/${page.slug}` },
          ],
        })}
      />
      <JsonLd data={faqSchema} />

      <MarketingHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div aria-hidden className="grid-field pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative mx-auto w-full max-w-3xl px-5 py-16 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-muted">
              <ChannelIcon platform={page.platform} size="sm" />
              {page.badge}
            </span>
            <h1 className="mt-5 font-display text-[clamp(1.9rem,4.5vw,3rem)] leading-[1.04] font-extrabold text-balance">
              {page.h1}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-muted">
              {page.subhead}
            </p>
          </div>
        </section>

        <article className="mx-auto w-full max-w-3xl px-5 py-14">
          {page.intro.map((paragraph, index) => (
            <p
              key={index}
              className="mt-3 text-[15.5px] leading-relaxed text-muted first:mt-0"
            >
              {paragraph}
            </p>
          ))}

          {/* Two sections, then the tool — the page earns the tool before showing it. */}
          {page.beforeTool.map((section) => (
            <Section key={section.heading} section={section} />
          ))}

          <div className="mt-12 scroll-mt-24" id="tool">
            <RepurposeTool
              platform={page.platform}
              platformName={page.platformName}
              isLoggedIn={Boolean(session)}
            />
          </div>

          {page.afterTool.map((section) => (
            <Section key={section.heading} section={section} />
          ))}

          {/* FAQ */}
          <div className="mt-14">
            <h2 className="font-display text-[22px] font-bold">
              {page.platformName} repurposing: frequently asked
            </h2>
            <dl className="mt-5 flex flex-col gap-3">
              {page.faq.map((item) => (
                <Card key={item.q} className="p-5">
                  <dt className="text-[15px] font-semibold">{item.q}</dt>
                  <dd className="mt-2 text-[14px] leading-relaxed text-muted">
                    {item.a}
                  </dd>
                </Card>
              ))}
            </dl>
          </div>
        </article>

        {/* CTA */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 text-center">
            <h2 className="font-display text-[24px] font-bold text-balance">
              One video in. A week of posts out.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
              Bring the {page.platformName} video you already made — Socialexie
              reshapes it for every network, writes the captions and schedules the
              whole set.
            </p>
            <div className="mt-7">
              <Button asChild size="lg">
                <Link href={session ? "/dashboard/composer" : "/signup"}>
                  {session ? "Open composer" : "Start free"}
                  <ArrowRight />
                </Link>
              </Button>
              <p className="mt-3 text-[12.5px] text-subtle">
                Two channels free forever · No card required
              </p>
            </div>
          </div>
        </section>

        {/* Related tools — internal links help both people and crawlers. */}
        <section className="mx-auto w-full max-w-3xl px-5 py-14">
          <h2 className="font-display text-[18px] font-bold">
            Repurpose from another network
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={`/tools/${other.slug}`}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 transition-colors hover:border-signal hover:bg-surface-2"
              >
                <ChannelIcon platform={other.platform} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    {other.platformName}
                  </span>
                  <span className="block text-[11.5px] text-subtle">Repurposer</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
