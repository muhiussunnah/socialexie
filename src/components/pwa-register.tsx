"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Production only: a cached app shell makes hot reloading lie about what the
 * source says, which costs more debugging time than offline support in dev is
 * ever worth.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Offline support is an enhancement; the app is fine without it.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
