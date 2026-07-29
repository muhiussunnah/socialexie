import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-16">
        <article
          className="
            [&_h1]:font-display [&_h1]:text-[32px] [&_h1]:font-extrabold
            [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-[19px] [&_h2]:font-bold
            [&_p]:mt-3 [&_p]:text-[14.5px] [&_p]:leading-relaxed [&_p]:text-muted
            [&_ul]:mt-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2
            [&_li]:pl-4 [&_li]:text-[14.5px] [&_li]:leading-relaxed [&_li]:text-muted
            [&_li]:relative [&_li]:before:absolute [&_li]:before:left-0
            [&_li]:before:text-signal [&_li]:before:content-['—']
            [&_strong]:text-fg [&_strong]:font-semibold
          "
        >
          {children}
        </article>
      </main>
      <MarketingFooter />
    </>
  );
}
