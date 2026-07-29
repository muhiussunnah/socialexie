const FAQS = [
  {
    q: "Which networks can Socialexie publish to?",
    a: "Facebook Pages, Instagram, TikTok, YouTube, X, LinkedIn, Pinterest and Threads. Each one is connected through its official API, so nothing depends on a browser extension that can get your account restricted.",
  },
  {
    q: "Is the one-time licence really forever?",
    a: "Yes. It never renews and it keeps receiving updates for the tier you bought. Monthly plans exist for people who would rather not pay up front — the product is identical.",
  },
  {
    q: "Will posting more often grow my account faster?",
    a: "Up to a point, then it backfires. Meta's spam policy names very high posting frequency as a demotion trigger, so Socialexie is tuned for a sustainable cadence and will warn you when a schedule looks like flooding.",
  },
  {
    q: "Do the comment-to-DM automations break platform rules?",
    a: "Not the way we run them. Sends stay inside the 24-hour messaging window, are capped at one automated message per person per day, use an explicit opt-in tap and go through official APIs. We also flag keyword-comment calls to action, because those reduce how far a post travels.",
  },
  {
    q: "Can I bring the queue I already have?",
    a: "Import a CSV or a sheet and map your columns once. Captions, media, target channels and times come across in a single pass.",
  },
  {
    q: "Who can see my content and connected accounts?",
    a: "Only you and the people you invite. Every table is protected by row-level security, tokens are encrypted at rest, and workspace data is isolated per account.",
  },
];

export function Faq() {
  return (
    <section className="border-t border-line py-20">
      <div className="mx-auto w-full max-w-3xl px-5">
        <h2 className="text-center font-display text-[clamp(1.75rem,3.6vw,2.5rem)] font-bold">
          Questions worth asking
        </h2>

        <div className="mt-10 flex flex-col gap-2">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-card border border-line bg-surface open:border-line-strong"
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden
                  className="ml-auto grid size-6 shrink-0 place-items-center rounded-full border border-line text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-[14px] leading-relaxed text-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
