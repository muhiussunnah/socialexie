import type { Metadata } from "next";
import { Studio } from "@/components/studio/studio";
import { currentUserCredentials } from "@/lib/ai/connections";
import {
  listModelOptions,
  listProviderStatus,
  runWithCredentials,
} from "@/lib/ai/providers";

export const metadata: Metadata = { title: "AI studio" };

// Which providers are reachable is decided by the environment and the
// workspace's own connected keys at request time, so this page must never be
// baked at build time.
export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const credentials = await currentUserCredentials();

  // Resolve availability inside the workspace's credential scope so a provider
  // the user connected themselves shows up as ready, exactly as generation sees it.
  const view = await runWithCredentials(credentials, async () => ({
    imageModels: listModelOptions("image"),
    textModels: listModelOptions("text"),
    providers: listProviderStatus(),
  }));

  return (
    <Studio
      imageModels={view.imageModels}
      textModels={view.textModels}
      providers={view.providers}
    />
  );
}
