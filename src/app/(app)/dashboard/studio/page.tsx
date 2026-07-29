import type { Metadata } from "next";
import { Studio } from "@/components/studio/studio";
import { listModelOptions, listProviderStatus } from "@/lib/ai/providers";

export const metadata: Metadata = { title: "AI studio" };

// Which providers are reachable is decided by the environment at request time,
// so this page must never be baked at build time.
export const dynamic = "force-dynamic";

export default function StudioPage() {
  return (
    <Studio
      imageModels={listModelOptions("image")}
      textModels={listModelOptions("text")}
      providers={listProviderStatus()}
    />
  );
}
