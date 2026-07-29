"use client";

import { CircleAlert, CircleCheck, Megaphone, ShieldCheck } from "lucide-react";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ENGAGEMENT_BAIT_GUIDANCE } from "@/lib/post-validation";
import type { PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

export interface Automation {
  id: string;
  name: string;
  channel: PlatformId;
  status: "live" | "paused" | "draft";
  keywords: string[];
  /** Rotated so one post never fills up with the same public sentence. */
  replies: string[];
  optInMessage: string;
  optInButton: string;
  payloadMessage: string;
  payloadLink: string;
  dailyCap: number;
  sentToday: number;
  /** Share of people who tapped the opt-in button, 0–1. */
  optInRate: number;
}

export interface ComplianceCheck {
  id: string;
  label: string;
  detail: string;
  /** `enforced` means the runtime guarantees it — there is nothing to get wrong. */
  state: "met" | "unmet" | "enforced";
}

/** Words ordinary commenters type by accident, so they make terrible triggers. */
const COLLIDING_KEYWORDS = new Set([
  "yes",
  "yep",
  "yeah",
  "info",
  "link",
  "send",
  "please",
  "want",
  "more",
  "this",
  "need",
]);

const HTTPS_URL = /^https:\/\/[^\s/$.?#][^\s]*$/i;

export function evaluateCompliance(draft: Automation): ComplianceCheck[] {
  const keywords = draft.keywords.map((word) => word.trim()).filter(Boolean);
  const replies = draft.replies.map((reply) => reply.trim()).filter(Boolean);
  const distinctReplies = new Set(replies.map((reply) => reply.toLowerCase()));

  const keywordsUsable =
    keywords.length > 0 &&
    keywords.every(
      (word) => word.length >= 3 && !COLLIDING_KEYWORDS.has(word.toLowerCase()),
    );

  return [
    {
      id: "api",
      label: "Official APIs only",
      detail:
        "Public replies and DMs go through the platform's own messaging API. No browser automation and no logged-in session scraping, which is what gets accounts restricted.",
      state: "enforced",
    },
    {
      id: "window",
      label: "Sends only inside the 24-hour window",
      detail:
        "A comment opens a 24-hour window to message that person. Anything still queued when the window closes is dropped instead of sent.",
      state: "enforced",
    },
    {
      id: "frequency",
      label: "One automated DM per person per day",
      detail:
        "Repeat commenters get the public reply and nothing else until the next day, however many times they comment.",
      state: "enforced",
    },
    {
      id: "keywords",
      label: "Trigger words are specific",
      detail: keywordsUsable
        ? `Triggering on ${keywords.map((word) => `“${word}”`).join(", ")}.`
        : "Use at least three characters, and avoid words people type by accident — “yes” and “info” fire on ordinary comments and burn the daily cap.",
      state: keywordsUsable ? "met" : "unmet",
    },
    {
      id: "replies",
      label: "Three or more public replies to rotate",
      detail:
        distinctReplies.size >= 3
          ? `${distinctReplies.size} variations in rotation.`
          : "Identical public replies stacked under one post read as spam to people and to ranking. Write at least three and they rotate.",
      state: distinctReplies.size >= 3 ? "met" : "unmet",
    },
    {
      id: "opt-in",
      label: "Opt-in before anything is sent",
      detail:
        draft.optInMessage.trim().length > 0 && draft.optInButton.trim().length > 0
          ? `First DM asks, with a “${draft.optInButton.trim()}” button.`
          : "The first DM has to ask permission and carry a button. The link only follows once they tap it.",
      state:
        draft.optInMessage.trim().length > 0 && draft.optInButton.trim().length > 0
          ? "met"
          : "unmet",
    },
    {
      id: "payload",
      label: "Payload has somewhere real to go",
      detail:
        draft.payloadMessage.trim().length > 0 && HTTPS_URL.test(draft.payloadLink.trim())
          ? `Delivering ${draft.payloadLink.trim()}`
          : "Add the follow-up message and an https link. A trigger with nothing behind it is the fastest way to lose the people who opted in.",
      state:
        draft.payloadMessage.trim().length > 0 && HTTPS_URL.test(draft.payloadLink.trim())
          ? "met"
          : "unmet",
    },
    {
      id: "cap",
      label: "Daily send cap set",
      detail:
        draft.dailyCap >= 1
          ? `Stops at ${draft.dailyCap.toLocaleString()} sends a day.`
          : "Set a ceiling. A post that unexpectedly travels can otherwise put thousands of DMs through a brand-new account in an hour.",
      state: draft.dailyCap >= 1 ? "met" : "unmet",
    },
  ];
}

export function isCompliant(checks: readonly ComplianceCheck[]): boolean {
  return checks.every((check) => check.state !== "unmet");
}

export function CompliancePanel({
  checks,
  className,
}: {
  checks: readonly ComplianceCheck[];
  className?: string;
}) {
  const outstanding = checks.filter((check) => check.state === "unmet").length;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Card>
        <CardHeader className="pb-2">
          <div>
            <CardTitle>Compliance</CardTitle>
            <CardDescription>
              {outstanding === 0
                ? "Everything this flow needs is in place."
                : `${outstanding} thing${outstanding === 1 ? "" : "s"} left before this can go live.`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <ul className="flex flex-col gap-3">
            {checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2.5">
                {check.state === "enforced" ? (
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-live" />
                ) : check.state === "met" ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                )}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium">
                    {check.label}
                    {check.state === "enforced" ? (
                      <span className="rounded-full bg-live-soft px-1.5 py-0.5 text-[10px] font-semibold text-live">
                        built in
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                    {check.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card className="border-signal-line bg-signal-soft">
        <CardBody className="pt-5">
          <p className="flex items-center gap-2 text-[12.5px] font-semibold text-signal">
            <Megaphone className="size-4" />
            Worth knowing before you build the post
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            {ENGAGEMENT_BAIT_GUIDANCE}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
