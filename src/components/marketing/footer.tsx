import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SocialShare } from "@/components/social-share";
import { site } from "@/lib/site";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#studio", label: "AI studio" },
      { href: "/#automation", label: "Automation" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/llms.txt", label: "llms.txt" },
      { href: "/feed.xml", label: "RSS feed" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create account" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/security", label: "Security" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-bg-sub">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted">
            {site.description}
          </p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">
              {col.title}
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13.5px] text-muted transition-colors hover:text-fg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-[12.5px] text-subtle">
          <span>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </span>
          <span className="font-mono">{site.domain}</span>
        </div>
      </div>

      {/* Floating page chrome — mounted here so every page that uses the
          marketing footer gets it without repeating itself. */}
      <SocialShare />
      <ScrollToTop />
    </footer>
  );
}
