import Link from "next/link";
import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { marketingNav } from "@/lib/site";
import { initials } from "@/lib/utils";

/** Session is best-effort here — a marketing page must render signed out too. */
async function currentUser() {
  try {
    return await getSession();
  } catch {
    return null;
  }
}

export async function MarketingHeader() {
  const session = await currentUser();

  return (
    <>
      {/* Outside the sticky element on purpose — the promo scrolls away, the nav
          stays. */}
      <AnnouncementBar />

      <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5">
          <Link href="/" aria-label="Socialexie home" className="shrink-0">
            <Logo />
          </Link>

          {/*
            Centred on the header rather than packed against the logo, so the
            links spread outward from the middle. Absolute positioning keeps the
            centre true regardless of how wide the logo or the action group get —
            a flex-1 nav would drift as soon as one side changed.
          */}
          <nav
            aria-label="Main"
            className="pointer-events-none absolute inset-x-0 hidden justify-center lg:flex"
          >
            <ul className="pointer-events-auto flex items-center gap-0.5">
              {marketingNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-[13px] whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {session ? (
              <>
                <Button asChild size="sm">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <Link
                  href="/dashboard/settings"
                  title={`${session.email} — account`}
                  aria-label="Account"
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[12px] font-semibold text-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  {initials(session.email.split("@")[0])}
                </Link>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/signup">Start free</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Below the centred breakpoint the links wrap onto their own row rather
            than disappearing behind a menu button. */}
        <nav
          aria-label="Main"
          className="border-t border-line lg:hidden"
        >
          <ul className="mx-auto flex w-full max-w-6xl items-center gap-0.5 overflow-x-auto px-3 py-1.5">
            {marketingNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-lg px-2.5 py-1.5 text-[13px] whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
    </>
  );
}
