import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Monthly plans from $99 or a one-time licence from $499. Same product, two ways to pay.",
};

export default function PricingPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <Pricing standalone />
        <Faq />
      </main>
      <MarketingFooter />
    </>
  );
}
