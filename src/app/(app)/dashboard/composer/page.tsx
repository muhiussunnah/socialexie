import type { Metadata } from "next";
import { Composer } from "@/components/composer/composer";
import { demoWorkspace } from "@/lib/demo";

export const metadata: Metadata = { title: "Composer" };

// The queue preview is anchored to the current time, so this page must be
// rendered per request rather than frozen at build.
export const dynamic = "force-dynamic";

export default function ComposerPage() {
  return (
    <Composer
      nowIso={new Date().toISOString()}
      timeZone={demoWorkspace.timezone}
    />
  );
}
