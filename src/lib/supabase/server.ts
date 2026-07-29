import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Request-scoped client that carries the caller's session, so every query
 * runs under row-level security as that user.
 */
export async function supabaseServer() {
  const env = publicEnv();
  const store = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(items) {
          try {
            for (const { name, value, options } of items) {
              store.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS, so it must never be constructed inside a
 * path that can be reached with unvalidated user input, and never in the
 * browser bundle.
 */
export function supabaseAdmin() {
  const pub = publicEnv();
  const srv = serverEnv();

  return createClient<Database>(
    pub.NEXT_PUBLIC_SUPABASE_URL,
    srv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
