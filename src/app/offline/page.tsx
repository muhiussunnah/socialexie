import type { Metadata } from "next";
import { RadioTower, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Offline",
  description: "Socialexie could not reach the network.",
  robots: { index: false, follow: false },
};

/**
 * Served by the service worker when a navigation cannot reach the network.
 *
 * Deliberately free of client JavaScript: the retry is a plain anchor, so the
 * page still works when the bundle is exactly what failed to load.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-bg px-6 py-16 text-fg">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-e2">
        <span
          aria-hidden
          className="mx-auto mb-6 flex size-14 items-center justify-center rounded-card bg-surface-2 text-muted"
        >
          <RadioTower className="size-6" />
        </span>

        <h1 className="font-display text-2xl font-semibold tracking-tight">
          No signal
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          Socialexie could not reach the network. Nothing has been lost —
          scheduled posts keep publishing from the server, and anything you were
          drafting is still here once the connection returns.
        </p>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <a href="/dashboard">
              <RefreshCw aria-hidden />
              Try again
            </a>
          </Button>
          <Button asChild variant="secondary">
            {/* Plain anchors on purpose: the client router cannot recover a
                navigation when the network is what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Go to home</a>
          </Button>
        </div>

        <p className="mt-6 text-xs text-subtle">
          Pages you have already opened stay available while you are offline.
        </p>
      </div>
    </main>
  );
}
