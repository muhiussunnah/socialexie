import Link from "next/link";
import { ChevronsUpDown, Plus, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";

export function Topbar({
  workspaceName,
  plan,
  userEmail,
}: {
  workspaceName: string;
  plan: string;
  userEmail: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-xl">
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-line-strong"
      >
        <span className="grid size-6 place-items-center rounded-md bg-signal text-[11px] font-bold text-signal-fg">
          {initials(workspaceName)}
        </span>
        <span className="max-w-[160px] truncate text-[13px] font-medium">
          {workspaceName}
        </span>
        <ChevronsUpDown className="size-3.5 text-subtle" />
      </button>

      <Badge tone="signal" className="hidden sm:inline-flex">
        {plan}
      </Badge>

      <label className="relative ml-auto hidden max-w-xs flex-1 md:block">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
        <input
          type="search"
          placeholder="Search posts, assets, channels"
          className="h-9 w-full rounded-lg border border-line bg-surface-2 pr-3 pl-8.5 text-[13px] placeholder:text-subtle focus:border-signal focus:outline-none"
        />
      </label>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <ThemeToggle />
        <Button asChild size="sm">
          <Link href="/dashboard/composer">
            <Plus />
            <span className="hidden sm:inline">New post</span>
          </Link>
        </Button>
        <span
          title={userEmail}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[12px] font-semibold text-muted"
        >
          {initials(userEmail.split("@")[0])}
        </span>
      </div>
    </header>
  );
}
