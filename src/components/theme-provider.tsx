"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "socialexie-theme";
const EVENT = "socialexie:theme";

interface ThemeContextValue {
  /** What the user picked, including "system". */
  choice: ThemeChoice;
  /** What is actually painted right now. */
  resolved: "light" | "dark";
  setChoice: (choice: ThemeChoice) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Script injected before paint so the first frame already has the right
 * theme. Kept in sync with `applyTheme` below.
 */
export const themeInitScript = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var choice = stored === "light" || stored === "dark" ? stored : "system";
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = choice === "dark" || (choice === "system" && prefersDark);
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`.trim();

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(choice: ThemeChoice): "light" | "dark" {
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  return dark ? "dark" : "light";
}

/*
 * The theme lives outside React — in localStorage, the OS preference, and a
 * class already stamped on <html> before hydration. useSyncExternalStore reads
 * it rather than copying it into state in an effect, which would cause an
 * extra render on every mount and fight the pre-paint script.
 *
 * The snapshot is a single string so React can compare it with Object.is.
 */
function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function getSnapshot(): string {
  const choice = readChoice();
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark());
  return `${choice}:${dark ? "dark" : "light"}`;
}

/** Dark is the product's default, so server output assumes it. */
function getServerSnapshot(): string {
  return "system:dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const [choice, resolved] = snapshot.split(":") as [
    ThemeChoice,
    "light" | "dark",
  ];

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can refuse storage; the class swap below still works
      // for this session.
    }
    applyTheme(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback(() => {
    setChoice(resolved === "dark" ? "light" : "dark");
  }, [resolved, setChoice]);

  const value = useMemo(
    () => ({ choice, resolved, setChoice, toggle }),
    [choice, resolved, setChoice, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
