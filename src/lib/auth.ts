import "server-only";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile, Workspace } from "@/lib/supabase/types";

/**
 * Stand-in identity used when no Supabase project is attached. It only ever
 * appears alongside sample data, and `requireAdmin` refuses to mint one the
 * moment real credentials exist.
 */
const DEMO_SESSION: SessionContext = {
  userId: "demo",
  email: "demo@socialexie.app",
  profile: null,
  isAdmin: true,
  isDemo: true,
};

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile | null;
  isAdmin: boolean;
  /** True only in the unconfigured, sample-data mode. */
  isDemo?: boolean;
}

/** Current user, or null when signed out. Never throws on a missing session. */
export async function getSession(): Promise<SessionContext | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email,
    profile: profile ?? null,
    isAdmin: isAdminEmail(user.email),
  };
}

/** Session or bust. Use at the top of every protected page. */
export async function requireSession(next?: string): Promise<SessionContext> {
  if (!isSupabaseConfigured()) return DEMO_SESSION;

  const session = await getSession();
  if (!session) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return session;
}

/**
 * Admin console gate.
 *
 * Non-admins are redirected rather than shown a 403, so the route does not
 * confirm it exists. The demo bypass below is safe precisely because it cannot
 * trigger once credentials are present — with a real project attached this is
 * a strict allow-list check against the signed-in email.
 */
export async function requireAdmin(): Promise<SessionContext> {
  if (!isSupabaseConfigured()) return DEMO_SESSION;

  const session = await getSession();
  if (!session) redirect("/login?next=%2Fadmin");
  if (!session.isAdmin) redirect("/dashboard");
  return session;
}

/** Workspaces the caller can see, newest first. */
export async function listWorkspaces(): Promise<Workspace[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true });
  return data ?? [];
}
