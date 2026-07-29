"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  AutomationList,
  SAMPLE_AUTOMATIONS,
} from "@/components/automations/automation-list";
import { AutomationForm } from "@/components/automations/automation-form";
import {
  CompliancePanel,
  evaluateCompliance,
  isCompliant,
  type Automation,
} from "@/components/automations/compliance-panel";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function blankDraft(): Automation {
  return {
    id: "",
    name: "",
    channel: "instagram",
    status: "draft",
    keywords: [],
    replies: ["", "", ""],
    optInMessage: "",
    optInButton: "",
    payloadMessage: "",
    payloadLink: "",
    dailyCap: 250,
    sentToday: 0,
    optInRate: 0,
  };
}

export function AutomationsWorkbench() {
  const [automations, setAutomations] = useState<Automation[]>(SAMPLE_AUTOMATIONS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Automation>(blankDraft);
  const nextId = useRef(SAMPLE_AUTOMATIONS.length + 1);

  const checks = evaluateCompliance(draft);
  const canSave = isCompliant(checks) && draft.name.trim().length > 0;

  const live = automations.filter((item) => item.status === "live");
  const sentToday = automations.reduce((total, item) => total + item.sentToday, 0);
  const averageOptIn =
    live.length === 0
      ? 0
      : live.reduce((total, item) => total + item.optInRate, 0) / live.length;

  function save() {
    const replies = draft.replies.filter((reply) => reply.trim().length > 0);

    if (editingId) {
      setAutomations((current) =>
        current.map((item) =>
          item.id === editingId ? { ...draft, replies } : item,
        ),
      );
      return;
    }

    const id = `a${nextId.current++}`;
    setAutomations((current) => [
      ...current,
      { ...draft, id, replies, status: "live" },
    ]);
    setEditingId(id);
    setDraft((current) => ({ ...current, id, replies, status: "live" }));
  }

  function startNew() {
    setEditingId(null);
    setDraft(blankDraft());
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold">Automations</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Comment-to-DM flows that stay inside what the platforms actually
            allow.
          </p>
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus />
          New automation
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Live", value: String(live.length), sub: "running now" },
          {
            label: "Sent today",
            value: sentToday.toLocaleString(),
            sub: "across all flows",
          },
          {
            label: "Opt-in rate",
            value: `${Math.round(averageOptIn * 100)}%`,
            sub: "average of live flows",
          },
        ].map((metric) => (
          <Card key={metric.label} className="p-4">
            <p className="text-[11px] tracking-[0.1em] text-subtle uppercase">
              {metric.label}
            </p>
            <p className="mt-2 font-display text-[28px] leading-none font-extrabold tabular">
              {metric.value}
            </p>
            <p className="mt-1.5 text-[12px] text-subtle">{metric.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-line px-5 py-4">
              <CardTitle>Flows</CardTitle>
              <CardDescription>
                Select one to edit, or pause it without losing the setup.
              </CardDescription>
            </div>
            <AutomationList
              automations={automations}
              selectedId={editingId}
              onSelect={(automation) => {
                setEditingId(automation.id);
                setDraft({ ...automation });
              }}
              onToggleStatus={(id) =>
                setAutomations((current) =>
                  current.map((item) =>
                    item.id === id
                      ? {
                          ...item,
                          status: item.status === "live" ? "paused" : "live",
                        }
                      : item,
                  ),
                )
              }
            />
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle>
                  {editingId ? "Edit flow" : "New flow"}
                </CardTitle>
                <CardDescription>
                  Comment triggers a public reply, then a DM that asks before it
                  sends anything.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <AutomationForm
                draft={draft}
                onChange={(patch) =>
                  setDraft((current) => ({ ...current, ...patch }))
                }
                onSave={save}
                onCancel={startNew}
                canSave={canSave}
                isNew={editingId === null}
              />
            </CardBody>
          </Card>
        </div>

        <CompliancePanel
          checks={checks}
          className="xl:sticky xl:top-6 xl:self-start"
        />
      </div>
    </div>
  );
}
