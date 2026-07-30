"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Keeps the auth cookie fresh from the browser.
 *
 * On platforms that support Node middleware, the edge layer refreshes the
 * Supabase session on every request. Cloudflare Workers cannot run Node
 * middleware, so the browser client does the rotating instead: instantiating
 * it starts its refresh timer, and re-rendering on rotation means the server
 * always reads a valid token on the next navigation.
 */
export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    let client: ReturnType<typeof supabaseBrowser>;
    try {
      client = supabaseBrowser();
    } catch {
      // Sample-data mode has no Supabase project to talk to.
      return;
    }

    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => data.subscription.unsubscribe();
  }, [router]);

  return null;
}
