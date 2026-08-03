import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * The signed-in user's primary workspace id, or null when there isn't one yet.
 *
 * Every user is provisioned exactly one workspace on sign-up (see the
 * `handle_new_user` trigger), so in practice this returns that workspace. It
 * reads under the caller's session, so row-level security guarantees the id
 * belongs to them. Never throws — a missing workspace degrades to null and the
 * caller shows a setup notice rather than crashing.
 */
export async function getPrimaryWorkspaceId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const session = await getSession();
    if (!session) return null;
    const client = (await supabaseServer()) as unknown as SupabaseClient;
    const { data } = await client
      .from("workspaces")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}
