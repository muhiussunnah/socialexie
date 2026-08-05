"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Flame,
  Images,
  LayoutGrid,
  PenSquare,
  Plug,
  Radio,
  Settings,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutGrid },
      { href: "/dashboard/composer", label: "Composer", icon: PenSquare },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    title: "Create",
    items: [
      { href: "/dashboard/studio", label: "AI studio", icon: Sparkles },
      { href: "/dashboard/connections", label: "AI providers", icon: Plug },
      { href: "/dashboard/library", label: "Library", icon: Images },
    ],
  },
  {
    title: "Grow",
    items: [
      { href: "/dashboard/viral-finder", label: "Viral finder", icon: Flame },
      { href: "/dashboard/automations", label: "Automations", icon: Zap },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dashboard/channels", label: "Channels", icon: Radio },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  isAdmin,
  usage,
}: {
  isAdmin: boolean;
  usage: { label: string; used: number; limit: number };
}) {
  const pathname = usePathname();
  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));

  return (
    <aside className="hidden w-[236px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-14 items-center px-4">
        <Link href="/dashboard" aria-label="Socialexie">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section) => (
          <div key={section.title ?? "root"} className="mb-5">
            {section.title ? (
              <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-subtle uppercase">
                {section.title}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
                        active
                          ? "bg-signal-soft font-medium text-signal"
                          : "text-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {isAdmin ? (
          <div className="mb-5">
            <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-subtle uppercase">
              Platform
            </p>
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
                isActive(pathname, "/admin")
                  ? "bg-signal-soft font-medium text-signal"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Shield className="size-4 shrink-0" />
              Admin console
            </Link>
          </div>
        ) : null}
      </nav>

      <div className="border-t border-line p-3">
        <div className="rounded-lg bg-surface-2 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] tracking-wide text-subtle uppercase">
              {usage.label}
            </span>
            <span className="font-mono text-[11px] text-muted tabular">
              {pct}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-signal transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] text-subtle tabular">
            {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}
          </p>
        </div>

        <Link
          href="/dashboard/settings"
          className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
