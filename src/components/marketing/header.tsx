import Link from "next/link";
import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { marketingNav } from "@/lib/site";

export function MarketingHeader() {
  return (
    <>
      {/* Outside the sticky element on purpose — the promo scrolls away, the nav
          stays. */}
      <AnnouncementBar />
      <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5">
        <Link href="/" aria-label="Socialexie home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Start free</Link>
          </Button>
        </div>
        </div>
      </header>
    </>
  );
}
