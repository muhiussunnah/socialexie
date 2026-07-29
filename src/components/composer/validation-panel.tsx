"use client";

import { CircleAlert, CircleCheck, Megaphone, TriangleAlert } from "lucide-react";
import { ChannelIcon } from "@/components/channel-icon";
import { ENGAGEMENT_BAIT_CODE, type Issue } from "@/lib/post-validation";
import { getPlatform, type PlatformId } from "@/lib/platforms";

export function ValidationPanel({
  targets,
  issues,
}: {
  targets: readonly PlatformId[];
  issues: Record<PlatformId, Issue[]>;
}) {
  // The reach note is about the words, not the network, so it is lifted out of
  // the per-channel lists instead of repeating on every one of them.
  let baitNote: Issue | null = null;
  const groups: { platform: PlatformId; issues: Issue[] }[] = [];
  let errors = 0;
  let warnings = 0;

  for (const platform of targets) {
    const list = issues[platform] ?? [];
    const rest: Issue[] = [];
    for (const issue of list) {
      if (issue.code === ENGAGEMENT_BAIT_CODE) {
        baitNote ??= issue;
        continue;
      }
      rest.push(issue);
      if (issue.level === "error") errors++;
      else warnings++;
    }
    if (rest.length > 0) groups.push({ platform, issues: rest });
  }

  const clean = groups.length === 0 && baitNote === null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[13px]">
        {clean ? (
          <>
            <CircleCheck className="size-4 text-ok" />
            <span className="text-muted">
              {targets.length > 0
                ? `Ready for all ${targets.length} channels.`
                : "Select a channel to run the checks."}
            </span>
          </>
        ) : (
          <>
            {errors > 0 ? (
              <CircleAlert className="size-4 text-danger" />
            ) : (
              <TriangleAlert className="size-4 text-warn" />
            )}
            <span className="text-muted">
              {errors > 0
                ? `${errors} ${errors === 1 ? "problem blocks" : "problems block"} publishing`
                : "Nothing blocking"}
              {warnings > 0 ? ` · ${warnings} to look at` : ""}
            </span>
          </>
        )}
      </div>

      {baitNote ? (
        <div className="rounded-lg border border-signal-line bg-signal-soft p-3">
          <p className="flex items-center gap-2 text-[12.5px] font-semibold text-signal">
            <Megaphone className="size-4" />
            Reach note
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            {baitNote.message}
          </p>
        </div>
      ) : null}

      {groups.map((group) => (
        <div
          key={group.platform}
          className="rounded-lg border border-line bg-surface-2 p-3"
        >
          <p className="flex items-center gap-2 text-[12.5px] font-medium">
            <ChannelIcon platform={group.platform} size="sm" />
            {getPlatform(group.platform).name}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {group.issues.map((issue) => (
              <li
                key={issue.code}
                className="flex items-start gap-2 text-[12.5px] leading-relaxed"
              >
                {issue.level === "error" ? (
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-danger" />
                ) : (
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
                )}
                <span
                  className={
                    issue.level === "error" ? "text-fg" : "text-muted"
                  }
                >
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
