"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} theme`}
      className={cn(
        "grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-muted",
        "transition-colors hover:border-line-strong hover:text-fg",
        className,
      )}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </button>
  );
}
