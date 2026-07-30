import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { PUBLIC_ROUTES } from "@/lib/public-routes";
import { buildGraph } from "@/lib/schema";

const route = PUBLIC_ROUTES.find((r) => r.path === "/pricing")!;

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Monthly plans from $99 or a one-time licence from $499. Same product, two ways to pay — with the limits for every tier listed up front.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    url: "/pricing",
    title: "Pricing — monthly plans and one-time licences",
    description:
      "Monthly plans from $99 or a one-time licence from $499. Same product, two ways to pay.",
  },
};

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={buildGraph({
          path: "/pricing",
          title: route.title,
          description: route.summary,
          updated: route.updated,
          includeApp: true,
          breadcrumbs: [
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ],
        })}
      />
      <MarketingHeader />
      <main id="main">
        <Pricing standalone />
        <Faq />
      </main>
      <MarketingFooter />
    </>
  );
}
