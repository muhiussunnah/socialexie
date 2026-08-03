"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MissingConfigError } from "@/lib/env";

/**
 * Step two of recovery. By the time this renders, /auth/confirm has already
 * exchanged the recovery token for a short-lived session, so `updateUser` is
 * authorised to set the new password. If the link expired there is no session
 * and the update fails — we translate that into a "request a new one" nudge.
 */
export function UpdatePasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const supabase = supabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setDone(true);
      startTransition(() => {
        router.push("/dashboard");
        router.refresh();
      });
    } catch (err) {
      if (err instanceof MissingConfigError) {
        setError(
          "Supabase is not configured yet. Add the keys to .env.local and restart.",
        );
      } else {
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        if (/session|token|expired|jwt/i.test(message)) {
          setExpired(true);
        } else {
          setError(message);
        }
      }
      setBusy(false);
    }
  }

  if (expired) {
    return (
      <div>
        <h1 className="font-display text-[26px] font-bold">Link expired</h1>
        <p className="mt-1.5 text-[14px] text-muted">
          This password reset link is no longer valid. Request a fresh one and
          we&apos;ll email it right over.
        </p>
        <Button asChild size="lg" className="mt-7 w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  const working = busy || pending || done;

  return (
    <div>
      <h1 className="font-display text-[26px] font-bold">Set a new password</h1>
      <p className="mt-1.5 text-[14px] text-muted">
        Choose a strong password you don&apos;t use anywhere else.
      </p>

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
        <Field label="New password" hint="At least 8 characters.">
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </Field>

        <Field label="Confirm password">
          <Input
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        {done ? (
          <p
            role="status"
            className="flex items-center gap-1.5 text-[13px] text-ok"
          >
            <CheckCircle2 className="size-4" aria-hidden /> Password updated —
            taking you in.
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={working}>
          {working ? <Loader2 className="animate-spin" /> : null}
          Update password
        </Button>
      </form>
    </div>
  );
}
