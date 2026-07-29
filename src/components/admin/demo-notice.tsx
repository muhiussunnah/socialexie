import { FlaskConical } from "lucide-react";
import { isDemoData } from "@/lib/admin-data";

/**
 * Nothing in the console should ever be mistaken for the real platform, so
 * every page states it out loud when the backend is missing.
 */
export function DemoNotice() {
  if (!isDemoData()) return null;

  return (
    <div className="flex items-start gap-2.5 rounded-card border border-signal-line bg-signal-soft px-3.5 py-2.5">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-signal" />
      <p className="text-[12.5px] text-muted">
        <span className="font-semibold text-fg">Demo data.</span> These numbers
        are generated from a fixed seed and belong to nobody. Set{" "}
        <code className="font-mono text-[11.5px]">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
        <code className="font-mono text-[11.5px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
        and <code className="font-mono text-[11.5px]">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
        to read the live platform.
      </p>
    </div>
  );
}
