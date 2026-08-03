import { Info } from "lucide-react";
import { SessionKeeper } from "@/components/auth/session-keeper";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { requireSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { demoMetrics, demoWorkspace } from "@/lib/demo";
import { planName, tierForUser } from "@/lib/licenses";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isSupabaseConfigured();

  // This layout is the authentication boundary for the whole product area.
  // There is no proxy in front of it on Cloudflare, so the redirect has to
  // happen here rather than at the network edge.
  const session = await requireSession("/dashboard");

  const workspaceName = demoWorkspace.name;
  const plan = planName(await tierForUser(session.userId));
  const email = session.email;

  return (
    <div className="flex min-h-dvh">
      <SessionKeeper />
      <Sidebar
        isAdmin={session.isAdmin}
        usage={{
          label: "AI images",
          used: demoMetrics.imageCredits.used,
          limit: demoMetrics.imageCredits.limit,
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar workspaceName={workspaceName} plan={plan} userEmail={email} />

        {!configured ? (
          <div className="flex items-start gap-2.5 border-b border-signal-line bg-signal-soft px-4 py-2.5 text-[12.5px]">
            <Info className="mt-0.5 size-4 shrink-0 text-signal" />
            <p className="text-muted">
              <span className="font-medium text-fg">Demo data.</span> Add your
              Supabase keys to <code className="font-mono">.env.local</code> to
              connect real accounts and start publishing.
            </p>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
