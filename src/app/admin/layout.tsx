import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminSidebar, AdminTabs } from "@/components/admin/admin-nav";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  // The console is staff-only; keep it out of every index even if a URL leaks.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="flex min-h-dvh bg-bg-sub">
      <aside className="hidden w-[196px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-12 items-center gap-2 border-b border-line px-3">
          <Link href="/admin" aria-label="Socialexie admin">
            <LogoMark className="size-6" />
          </Link>
          <span className="font-display text-[13px] font-bold tracking-[-0.02em]">
            Console
          </span>
        </div>
        <AdminSidebar />
        <div className="mt-auto border-t border-line p-3">
          <p className="truncate font-mono text-[11px] text-subtle" title={session.email}>
            {session.email}
          </p>
          <p className="mt-0.5 text-[11px] text-subtle">Platform staff</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2.5 border-b border-line bg-bg/90 px-3 backdrop-blur-xl">
          <Link href="/admin" className="lg:hidden" aria-label="Socialexie admin">
            <Logo showWordmark={false} />
          </Link>
          <span className="hidden font-display text-[13px] font-semibold lg:inline">
            Socialexie
          </span>
          <Badge tone="danger" className="uppercase">
            Admin
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="size-8" />
            <Link
              href="/dashboard"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              <ArrowLeft className="size-3.5" />
              Back to app
            </Link>
          </div>
        </header>

        <AdminTabs />

        <main className="min-w-0 flex-1 p-3 md:p-5">{children}</main>
      </div>
    </div>
  );
}
