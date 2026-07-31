import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { Card } from "@/components/ui/card";
import { PUBLIC_ROUTES } from "@/lib/public-routes";
import { buildGraph } from "@/lib/schema";
import { contact, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Reach the ${site.name} team about support, billing, security reports or partnerships.`,
  alternates: { canonical: "/contact" },
};

const REASONS = [
  {
    icon: LifeBuoy,
    title: "Support",
    body: "Something is broken, a channel will not connect, or a post did not go out. Include the workspace name and roughly when it happened — it makes the answer far faster.",
    subject: "Support",
  },
  {
    icon: BookOpen,
    title: "Billing & plans",
    body: "Questions about a monthly plan, a one-time licence, upgrading a tier, or an invoice.",
    subject: "Billing",
  },
  {
    icon: ShieldCheck,
    title: "Security",
    body: "Found a vulnerability? Report it privately first and give us a reasonable window to ship a fix. We will not pursue good-faith research that avoids privacy violations and service disruption.",
    subject: "Security report",
  },
];

export default function ContactPage() {
  const route = PUBLIC_ROUTES.find((r) => r.path === "/contact");

  return (
    <>
      {route ? (
        <JsonLd
          data={buildGraph({
            path: "/contact",
            title: route.title,
            description: route.summary,
            updated: route.updated,
            breadcrumbs: [
              { name: "Home", path: "/" },
              { name: "Contact", path: "/contact" },
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
              Contact
            </p>
            <h1 className="mt-4 font-display text-[clamp(2rem,5vw,3rem)] leading-[1.04] font-extrabold">
              Talk to a person.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-[16.5px] leading-relaxed text-muted">
              One inbox, read by the people who build the product. No ticket
              maze.
            </p>

            <a
              href={`mailto:${contact.email}`}
              className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-signal-line bg-signal-soft px-5 py-3 font-medium text-signal transition-colors hover:bg-signal hover:text-signal-fg"
            >
              <Mail className="size-4" aria-hidden />
              {contact.email}
            </a>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto w-full max-w-4xl px-5">
            <div className="grid gap-4 md:grid-cols-3">
              {REASONS.map((reason) => (
                <Card key={reason.title} className="flex flex-col p-5">
                  <reason.icon className="size-5 text-signal" />
                  <h2 className="mt-4 text-[15px] font-semibold">
                    {reason.title}
                  </h2>
                  <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-muted">
                    {reason.body}
                  </p>
                  <a
                    href={`mailto:${contact.email}?subject=${encodeURIComponent(reason.subject)}`}
                    className="mt-4 text-[13px] font-medium text-signal underline-offset-2 hover:underline"
                  >
                    Email about {reason.title.toLowerCase()} →
                  </a>
                </Card>
              ))}
            </div>

            <Card className="mt-6 p-5">
              <h2 className="text-[15px] font-semibold">Before you write in</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                Two pages answer most of what arrives in the inbox:{" "}
                <Link href="/pricing" className="text-signal underline-offset-2 hover:underline">
                  pricing
                </Link>{" "}
                covers plan limits and how the one-time licence differs from a
                subscription, and{" "}
                <Link
                  href="/legal/security"
                  className="text-signal underline-offset-2 hover:underline"
                >
                  security
                </Link>{" "}
                covers data isolation, token storage and the automation
                guardrails.
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
                We answer on working days and aim for one business day, but we
                would rather set that expectation honestly than publish a
                response time we cannot hold to.
              </p>
            </Card>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
