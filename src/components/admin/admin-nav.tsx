"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  HardDrive,
  KeyRound,
  ScrollText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: Gauge },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/licenses", label: "Licenses", icon: KeyRound },
  { href: "/admin/assets", label: "Assets", icon: HardDrive },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      <p className="px-2 pt-1 pb-2 text-[10px] font-semibold tracking-[0.16em] text-subtle uppercase">
        Platform
      </p>
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
              active
                ? "bg-surface-3 font-medium text-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Horizontal fallback below the top strip on narrow screens. */
export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-1.5 lg:hidden">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors",
              active
                ? "bg-surface-3 font-medium text-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
