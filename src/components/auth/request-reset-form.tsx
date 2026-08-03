"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MissingConfigError } from "@/lib/env";

/**
 * Step one of recovery: email a reset link. The success copy is deliberately
 * neutral ("if an account exists") so the form can't be used to probe which
 * addresses are registered.
 */
export function RequestResetForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const email = String(
      new FormData(event.currentTarget).get("email") ?? "",
    ).trim();

    try {
      const supabase = supabaseBrowser();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password` },
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      if (err instanceof MissingConfigError) {
        setError(
          "Supabase is not configured yet. Add the keys to .env.local and restart.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div>
        <div className="grid size-11 place-items-center rounded-xl border border-transparent bg-ok-soft">
          <MailCheck className="size-5 text-ok" aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-[26px] font-bold">
          Check your inbox
        </h1>
        <p className="mt-1.5 text-[14px] text-muted">
          If an account exists for that address, a link to set a new password is
          on its way. It expires in an hour.
        </p>
        <Link
          href="/login"
          className="mt-7 inline-flex items-center gap-1.5 text-[13px] font-medium text-signal underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[26px] font-bold">Reset your password</h1>
      <p className="mt-1.5 text-[14px] text-muted">
        Enter your email and we&apos;ll send a secure link to set a new one.
      </p>

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
        <Field label="Email">
          <Input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@studio.com"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-muted">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-signal underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
