import {
  BarChart3,
  Bot,
  CalendarClock,
  FileSpreadsheet,
  Layers,
  MessagesSquare,
  Palette,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SIZE_PRESETS } from "@/lib/platforms";

function SectionHead({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-signal uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.5rem)] font-bold">
        {title}
      </h2>
      <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{blurb}</p>
    </div>
  );
}

const FEATURES = [
  {
    icon: Layers,
    title: "Compose once, tailor per network",
    body: "One editor, eight outputs. Each network gets its own caption, crop and format — with live previews and the platform's real limits enforced before you schedule.",
  },
  {
    icon: CalendarClock,
    title: "Time-slot queue, not a calendar chore",
    body: "Define the slots your audience actually shows up for. Drop content in and Socialexie fills the next opening automatically, in the right timezone.",
  },
  {
    icon: Repeat2,
    title: "Evergreen recycling",
    body: "Sort posts into categories and let your best work resurface on a loop, with spacing rules so nothing repeats too close together.",
  },
  {
    icon: FileSpreadsheet,
    title: "Bulk import in one file",
    body: "Drop a CSV or a sheet and queue hundreds of posts at once — captions, media, targets and times mapped in a single pass.",
  },
  {
    icon: BarChart3,
    title: "Analytics that name the lever",
    body: "Watch time, shares and saves surfaced ahead of vanity likes, because those are the signals that actually move reach.",
  },
  {
    icon: Users,
    title: "Brands, seats and approvals",
    body: "Run many brands from one login, invite a team, and hold posts behind approval before anything reaches a live channel.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-line py-20">
      <div className="mx-auto w-full max-w-6xl px-5">
        <SectionHead
          eyebrow="The desk"
          title="Everything the busywork used to eat"
          blurb="The parts of publishing that steal your week — reformatting, re-uploading, re-timing — handled once and then left alone."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-5 transition-colors hover:border-line-strong">
              <f.icon className="size-5 text-signal" />
              <h3 className="mt-4 text-[15px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                {f.body}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StudioSection() {
  return (
    <section id="studio" className="border-t border-line bg-bg-sub py-20">
      <div className="mx-auto w-full max-w-6xl px-5">
        <SectionHead
          eyebrow="AI studio"
          title="Every good image model, one prompt box"
          blurb="Route the same prompt to Gemini, OpenAI, Anthropic or anything on OpenRouter — then render it at the exact size the network wants."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Palette className="size-4 text-signal" />
              <span className="text-[13px] font-medium">Canvas presets</span>
              <Badge tone="signal" className="ml-auto">
                Custom sizes too
              </Badge>
            </div>
            <ul className="divide-y divide-line">
              {SIZE_PRESETS.map((preset) => (
                <li
                  key={preset.id}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px]"
                >
                  <span
                    aria-hidden
                    className="shrink-0 rounded-[3px] border border-signal-line bg-signal-soft"
                    style={{
                      width: `${Math.max(8, (preset.width / preset.height) * 22)}px`,
                      height: "22px",
                    }}
                  />
                  <span className="flex-1">{preset.label}</span>
                  <span className="font-mono text-[11px] text-subtle tabular">
                    {preset.width}×{preset.height}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid gap-4">
            {[
              {
                icon: Bot,
                title: "Provider routing with fallback",
                body: "Pick a model per job or let the router choose on cost and availability. If one provider is down or rate-limited, the next one picks the job up.",
              },
              {
                icon: Wand2,
                title: "Prompts that already know your brand",
                body: "Save a voice and a look once. Every generation inherits them, so batches come out on-brand instead of generically pretty.",
              },
              {
                icon: Sparkles,
                title: "Batch, then straight to the queue",
                body: "Generate thirty variations, keep the six that work, and send them into the schedule without a single download.",
              },
            ].map((item) => (
              <Card key={item.title} className="p-5">
                <item.icon className="size-5 text-signal" />
                <h3 className="mt-4 text-[15px] font-semibold">{item.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                  {item.body}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AutomationSection() {
  return (
    <section id="automation" className="border-t border-line py-20">
      <div className="mx-auto w-full max-w-6xl px-5">
        <SectionHead
          eyebrow="Automation"
          title="Comment-to-DM, built to survive the algorithm"
          blurb="The keyword funnel everyone runs — with the guardrails almost nobody implements."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <MessagesSquare className="size-5 text-signal" />
            <h3 className="mt-4 text-[15px] font-semibold">
              Keyword triggers with an opt-in step
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              A comment opens the conversation, a tap confirms it. That second
              step is what turns a reply into real consent instead of a guess.
            </p>
          </Card>

          <Card className="p-5">
            <ShieldCheck className="size-5 text-live" />
            <h3 className="mt-4 text-[15px] font-semibold">
              Messaging windows enforced for you
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Sends are held to the 24-hour window and one automated message per
              person per day. Anything that would break the rule never leaves
              the queue.
            </p>
          </Card>

          <Card className="p-5">
            <Repeat2 className="size-5 text-info" />
            <h3 className="mt-4 text-[15px] font-semibold">
              Rotating replies, paced sends
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Public replies rotate across variations and sends are rate-paced,
              so a spike in comments never reads as a bot flooding a thread.
            </p>
          </Card>
        </div>

        <Card className="mt-4 border-signal-line bg-signal-soft p-5">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-signal" />
            <div>
              <h3 className="text-[15px] font-semibold">
                And a warning most tools will not give you
              </h3>
              <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-muted">
                Asking people to comment a specific word is the exact behaviour
                Meta says it will not recommend to non-followers. Socialexie
                flags it in the composer, keeps the funnel for the few posts
                that earn it, and pushes open-ended calls to action everywhere
                else — because reach you keep beats comments you rent.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
