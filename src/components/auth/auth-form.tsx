"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MissingConfigError } from "@/lib/env";

type Mode = "login" | "signup";

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  login: {
    title: "Welcome back",
    sub: "Sign in to your control room.",
    cta: "Sign in",
  },
  signup: {
    title: "Create your account",
    sub: "Two channels free, no card required.",
    cta: "Create account",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const needsSetup = params.get("setup") === "1";
  const copy = COPY[mode];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("full_name") ?? "").trim();

    try {
      const supabase = supabaseBrowser();

      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || null },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (signUpError) throw signUpError;
        setNotice(
          "Check your inbox to confirm the address, then sign in.",
        );
        setBusy(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      const next = params.get("next") ?? "/dashboard";
      startTransition(() => {
        router.push(next);
        router.refresh();
      });
    } catch (err) {
      if (err instanceof MissingConfigError) {
        setError(
          "Supabase is not configured yet. Add the keys from .env.example to .env.local and restart the dev server.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <div>
      <h1 className="font-display text-[26px] font-bold">{copy.title}</h1>
      <p className="mt-1.5 text-[14px] text-muted">{copy.sub}</p>

      {needsSetup ? (
        <div className="mt-5 flex gap-2.5 rounded-lg border border-signal-line bg-signal-soft p-3 text-[13px]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-signal" />
          <p className="text-muted">
            This deployment has no Supabase credentials yet, so accounts are
            unavailable. Copy <code className="font-mono">.env.example</code> to{" "}
            <code className="font-mono">.env.local</code> and fill it in.
          </p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
        {mode === "signup" ? (
          <Field label="Your name">
            <Input
              name="full_name"
              autoComplete="name"
              placeholder="Jane Rivera"
            />
          </Field>
        ) : null}

        <Field label="Email">
          <Input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@studio.com"
          />
        </Field>

        <Field
          label="Password"
          hint={mode === "signup" ? "At least 8 characters." : undefined}
        >
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            placeholder="••••••••"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-[13px] text-live">
            {notice}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={working}>
          {working ? <Loader2 className="animate-spin" /> : null}
          {copy.cta}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-muted">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-signal underline-offset-2 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have one?{" "}
            <Link href="/login" className="font-medium text-signal underline-offset-2 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
