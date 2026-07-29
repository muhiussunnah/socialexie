import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ChannelIcon } from "@/components/channel-icon";
import { LiveDot } from "@/components/ui/badge";
import { PLATFORM_LIST } from "@/lib/platforms";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" aria-label="Socialexie home" className="w-fit">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-[12px] text-subtle">
          Protected by row-level security. We never post without your say-so.
        </p>
      </div>

      {/* Brand side — the product's promise, not a stock illustration */}
      <div className="relative hidden overflow-hidden border-l border-line bg-bg-sub lg:block">
        <div aria-hidden className="grid-field absolute inset-0 opacity-60" />

        <div className="relative flex h-full flex-col justify-center gap-8 px-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted">
              <LiveDot />
              12 posts going out today
            </span>
            <h2 className="mt-5 font-display text-[2.5rem] leading-[1.05] font-extrabold">
              One queue.
              <br />
              Every network.
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
              Stop rebuilding the same post eight times. Write it once, let
              Socialexie shape it for each channel and put it on the schedule.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PLATFORM_LIST.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2"
              >
                <ChannelIcon platform={p.id} size="sm" />
                <span className="text-[12.5px] text-muted">{p.name}</span>
              </div>
            ))}
          </div>

          <dl className="grid grid-cols-3 gap-4 border-t border-line pt-6">
            {[
              ["Networks", "8"],
              ["Queue", "Unlimited"],
              ["Setup", "~4 min"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] tracking-wide text-subtle uppercase">
                  {label}
                </dt>
                <dd className="mt-1 font-display text-[19px] font-bold">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
