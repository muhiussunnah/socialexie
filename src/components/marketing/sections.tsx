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
import { ChannelIcon } from "@/components/channel-icon";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PLATFORM_LIST, SIZE_PRESETS } from "@/lib/platforms";
import { cn } from "@/lib/utils";

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
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-signal uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.05] font-bold tracking-[-0.025em]">
        {title}
      </h2>
      <p className="mt-4 text-[15.5px] leading-relaxed text-muted">{blurb}</p>
    </Reveal>
  );
}

/** Bento tile. `span` drives how much of the 6-column grid it claims. */
function Tile({
  icon: Icon,
  title,
  body,
  span = "md:col-span-2",
  children,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  span?: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className={span}>
      <Card className="edge-glow group relative flex h-full flex-col overflow-hidden p-6 transition-transform duration-500 hover:-translate-y-1">
        <span className="grid size-10 place-items-center rounded-xl border border-signal-line bg-signal-soft">
          <Icon className="size-4.5 text-signal" />
        </span>
        <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.01em]">
          {title}
        </h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{body}</p>
        {children ? <div className="mt-5">{children}</div> : null}
      </Card>
    </Reveal>
  );
}

export function Features() {
  return (
    <section id="features" className="relative border-t border-line py-24">
      <div className="mx-auto w-full max-w-6xl px-5">
        <SectionHead
          eyebrow="The desk"
          title="Everything the busywork used to eat"
          blurb="The parts of publishing that steal your week — reformatting, re-uploading, re-timing — handled once and then left alone."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          <Tile
            icon={Layers}
            title="Compose once, tailor per network"
            body="One editor, eight outputs. Each network gets its own caption, crop and format — with live previews and the platform's real limits enforced before you can schedule."
            span="md:col-span-4"
            delay={40}
          >
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_LIST.map((p, i) => (
                <span
                  key={p.id}
                  className="transition-transform duration-500"
                  style={{ transitionDelay: `${i * 30}ms` }}
                >
                  <ChannelIcon platform={p.id} />
                </span>
              ))}
            </div>
          </Tile>

          <Tile
            icon={CalendarClock}
            title="A queue, not a calendar chore"
            body="Define the slots your audience shows up for. Drop content in and it fills the next opening automatically, in the right timezone."
            delay={90}
          >
            <div className="flex items-end gap-1">
              {[38, 62, 44, 78, 55, 90, 48].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm bg-signal/25 transition-[height] duration-700 group-hover:bg-signal/50"
                  style={{ height: `${h * 0.42}px` }}
                />
              ))}
            </div>
          </Tile>

          <Tile
            icon={Repeat2}
            title="Evergreen recycling"
            body="Sort posts into categories and let your best work resurface on a loop, with spacing rules so nothing repeats too close together."
            delay={40}
          />

          <Tile
            icon={BarChart3}
            title="Analytics that name the lever"
            body="Watch time, shares and saves surfaced ahead of vanity likes — those are the signals that actually move reach."
            span="md:col-span-2"
            delay={90}
          >
            <div className="flex gap-2">
              {[
                { k: "Shares", v: "+41%", tone: "live" as const },
                { k: "Saves", v: "+26%", tone: "ok" as const },
              ].map((m) => (
                <Badge key={m.k} tone={m.tone}>
                  {m.k} {m.v}
                </Badge>
              ))}
            </div>
          </Tile>

          <Tile
            icon={FileSpreadsheet}
            title="Bulk import in one file"
            body="Drop a CSV and queue hundreds of posts at once — captions, media, targets and times mapped in a single pass."
            delay={140}
          />

          <Tile
            icon={Users}
            title="Brands, seats and approvals"
            body="Run many brands from one login, invite a team, and hold posts behind approval before anything reaches a live channel."
            span="md:col-span-3"
            delay={40}
          />

          <Tile
            icon={ShieldCheck}
            title="Guardrails that are actually enforced"
            body="Messaging windows, per-person daily caps and cadence warnings live in the database and the composer — not in a policy page nobody reads."
            span="md:col-span-3"
            delay={90}
          />
        </div>
      </div>
    </section>
  );
}

export function StudioSection() {
  return (
    <section id="studio" className="relative overflow-hidden border-t border-line py-24">
      <div
        aria-hidden
        className="halo animate-drift-slow"
        style={{
          top: "10%",
          right: "-14%",
          width: "34rem",
          height: "34rem",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--halo) 45%, transparent), transparent 70%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-5">
        <SectionHead
          eyebrow="AI studio"
          title="Every good image model, one prompt box"
          blurb="Route the same prompt to Gemini, OpenAI, Anthropic or anything on OpenRouter — then render it at the exact size the network wants."
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <Reveal>
            <Card className="edge-glow overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <Palette className="size-4 text-signal" />
                <span className="text-[13px] font-medium">Canvas presets</span>
                <Badge tone="signal" className="ml-auto">
                  Custom sizes too
                </Badge>
              </div>
              <ul className="divide-y divide-line">
                {SIZE_PRESETS.map((preset, i) => (
                  <li
                    key={preset.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-surface-2"
                    style={{ animation: `float 7s ease-in-out ${i * 0.4}s infinite` }}
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
          </Reveal>

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
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <Card className="edge-glow p-5 transition-transform duration-500 hover:-translate-y-1">
                  <item.icon className="size-5 text-signal" />
                  <h3 className="mt-4 text-[15px] font-semibold">{item.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                    {item.body}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AutomationSection() {
  const cards = [
    {
      icon: MessagesSquare,
      tone: "text-signal",
      title: "Keyword triggers with an opt-in step",
      body: "A comment opens the conversation, a tap confirms it. That second step is what turns a reply into real consent instead of a guess.",
    },
    {
      icon: ShieldCheck,
      tone: "text-live",
      title: "Messaging windows enforced for you",
      body: "Sends are held to the 24-hour window and one automated message per person per day. Anything that would break the rule never leaves the queue.",
    },
    {
      icon: Repeat2,
      tone: "text-info",
      title: "Rotating replies, paced sends",
      body: "Public replies rotate across variations and sends are rate-paced, so a spike in comments never reads as a bot flooding a thread.",
    },
  ];

  return (
    <section id="automation" className="relative border-t border-line py-24">
      <div className="mx-auto w-full max-w-6xl px-5">
        <SectionHead
          eyebrow="Automation"
          title="Comment-to-DM, built to survive the algorithm"
          blurb="The keyword funnel everyone runs — with the guardrails almost nobody implements."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {cards.map((card, i) => (
            <Reveal key={card.title} delay={i * 80}>
              <Card className="edge-glow h-full p-6 transition-transform duration-500 hover:-translate-y-1">
                <card.icon className={cn("size-5", card.tone)} />
                <h3 className="mt-4 text-[15px] font-semibold">{card.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                  {card.body}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <Card className="mt-4 border-signal-line bg-signal-soft p-6">
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
        </Reveal>
      </div>
    </section>
  );
}
