"use client";

import { CirclePause, Play } from "lucide-react";
import type { Automation } from "@/components/automations/compliance-panel";
import { ChannelIcon } from "@/components/channel-icon";
import { Badge, LiveDot } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const SAMPLE_AUTOMATIONS: Automation[] = [
  {
    id: "a1",
    name: "Bedtime one-pager",
    channel: "instagram",
    status: "live",
    keywords: ["BEDTIME"],
    replies: [
      "Sent it over — check your messages.",
      "Just sent you the one-pager.",
      "On its way to your inbox now.",
    ],
    optInMessage:
      "Happy to send you the bedtime one-pager. Want me to drop it here?",
    optInButton: "Send it over",
    payloadMessage: "Here it is — the 10-minute rule on a single page.",
    payloadLink: "https://approvedbyfamilies.example/bedtime",
    dailyCap: 400,
    sentToday: 168,
    optInRate: 0.71,
  },
  {
    id: "a2",
    name: "Snack drawer list",
    channel: "facebook",
    status: "live",
    keywords: ["SNACKS", "SNACKLIST"],
    replies: [
      "Sent — it is in your messages.",
      "Just messaged you the list.",
      "Landed in your inbox a second ago.",
      "Sent it across, enjoy.",
    ],
    optInMessage: "Want the snack drawer list we actually use?",
    optInButton: "Yes please",
    payloadMessage: "Twelve things, all of them survive a school run.",
    payloadLink: "https://approvedbyfamilies.example/snacks",
    dailyCap: 250,
    sentToday: 94,
    optInRate: 0.64,
  },
  {
    id: "a3",
    name: "Reel script pack",
    channel: "instagram",
    status: "paused",
    keywords: ["SCRIPTS"],
    replies: [
      "Sent you the pack.",
      "Just went out — check your DMs.",
      "In your inbox now.",
    ],
    optInMessage: "The script pack is free. Want it sent here?",
    optInButton: "Send the pack",
    payloadMessage: "Twenty openers that stop the scroll.",
    payloadLink: "https://approvedbyfamilies.example/scripts",
    dailyCap: 300,
    sentToday: 0,
    optInRate: 0.58,
  },
  {
    id: "a4",
    name: "Meal plan waitlist",
    channel: "facebook",
    status: "draft",
    keywords: ["MEALPLAN"],
    replies: ["Added you to the list.", "You are on the waitlist."],
    optInMessage: "",
    optInButton: "",
    payloadMessage: "You are on the list — first look goes out Monday.",
    payloadLink: "https://approvedbyfamilies.example/meal-plan",
    dailyCap: 150,
    sentToday: 0,
    optInRate: 0,
  },
];

const STATUS_TONE = {
  live: "ok",
  paused: "warn",
  draft: "neutral",
} as const;

export function AutomationList({
  automations,
  selectedId,
  onSelect,
  onToggleStatus,
}: {
  automations: readonly Automation[];
  selectedId: string | null;
  onSelect: (automation: Automation) => void;
  onToggleStatus: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-line">
      {automations.map((automation) => {
        const usage = Math.min(
          100,
          Math.round((automation.sentToday / Math.max(1, automation.dailyCap)) * 100),
        );

        return (
          <li
            key={automation.id}
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors",
              selectedId === automation.id ? "bg-surface-2" : "hover:bg-surface-2",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(automation)}
              className="flex min-w-[220px] flex-1 items-center gap-3 text-left"
            >
              <ChannelIcon platform={automation.channel} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium">
                  {automation.name}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {automation.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-muted"
                    >
                      {keyword}
                    </span>
                  ))}
                </span>
              </span>
            </button>

            <div className="w-[124px]">
              <p className="font-mono text-[11.5px] text-muted tabular">
                {automation.sentToday.toLocaleString()} /{" "}
                {automation.dailyCap.toLocaleString()}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-signal"
                  style={{ width: `${usage}%` }}
                />
              </div>
              <p className="mt-1 text-[10.5px] text-subtle">sent today</p>
            </div>

            <div className="w-[68px]">
              <p className="font-mono text-[13px] font-semibold tabular">
                {Math.round(automation.optInRate * 100)}%
              </p>
              <p className="text-[10.5px] text-subtle">opt-in</p>
            </div>

            <Badge tone={STATUS_TONE[automation.status]} className="capitalize">
              {automation.status === "live" ? <LiveDot /> : null}
              {automation.status}
            </Badge>

            {automation.status === "draft" ? null : (
              <button
                type="button"
                onClick={() => onToggleStatus(automation.id)}
                aria-label={
                  automation.status === "live"
                    ? `Pause ${automation.name}`
                    : `Resume ${automation.name}`
                }
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-fg"
              >
                {automation.status === "live" ? (
                  <CirclePause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
