import type { Metadata } from "next";
import { Info } from "lucide-react";
import { ProviderCard } from "@/components/app/connections/provider-card";
import { getConnections } from "@/lib/ai/connections";

export const metadata: Metadata = { title: "AI providers" };

// Connection state depends on the signed-in user, never cache it.
export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const connections = await getConnections();
  const anyPlatformManaged = connections.some((c) => c.platformManaged);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h1 className="font-display text-[26px] font-bold">AI providers</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-muted">
          Connect Claude, OpenAI, Gemini or OpenRouter with your own API keys.
          Captions and images in the studio then run on your account and your
          quota — pick which providers are on and the default model for each.
        </p>
      </div>

      {anyPlatformManaged ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-info-soft bg-info-soft/40 px-4 py-3 text-[12.5px]">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          <p className="text-muted">
            <span className="font-medium text-fg">Covered by default.</span>{" "}
            Providers marked <span className="font-medium">Platform default</span>{" "}
            already work on Socialexie&rsquo;s shared keys. Add your own only when
            you want generation billed to your account or want to raise your
            limits.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {connections.map((connection) => (
          <ProviderCard key={connection.id} connection={connection} />
        ))}
      </div>
    </div>
  );
}
