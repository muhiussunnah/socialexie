"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser-side Supabase client. Reused so auth state stays in one place. */
export function supabaseBrowser() {
  if (cached) return cached;
  const env = publicEnv();
  cached = createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return cached;
}
