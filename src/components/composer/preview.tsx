"use client";

import {
  Bookmark,
  Ellipsis,
  Eye,
  Globe,
  Heart,
  ImagePlus,
  MessageCircle,
  Music2,
  Play,
  Repeat2,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react";
import type { MediaItem } from "@/components/composer/media-dropzone";
import { ChannelIcon } from "@/components/channel-icon";
import { demoChannels, demoWorkspace } from "@/lib/demo";
import { isVideoFormat } from "@/lib/post-validation";
import { getPlatform, type PlatformId, type PostFormat } from "@/lib/platforms";
import { cn, compactNumber, initials } from "@/lib/utils";

interface MockProps {
  platform: PlatformId;
  body: string;
  media: readonly MediaItem[];
  format: PostFormat;
}

/**
 * Faithful-enough renderings of how the post lands on each network.
 *
 * The point is not pixel parity with the real apps — it is showing the writer
 * where their caption gets cut, where the media crops, and what a 280-character
 * ceiling actually looks like, before it is published rather than after.
 */
export function PreviewPanel({
  targets,
  platform,
  onPlatformChange,
  body,
  media,
  format,
}: {
  targets: readonly PlatformId[];
  platform: PlatformId | null;
  onPlatformChange: (platform: PlatformId) => void;
  body: string;
  media: readonly MediaItem[];
  format: PostFormat;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1">
        {targets.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPlatformChange(id)}
            aria-pressed={platform === id}
            title={getPlatform(id).name}
            className={cn(
              "rounded-lg p-1 transition-colors",
              platform === id
                ? "bg-surface-3"
                : "opacity-55 hover:opacity-100",
            )}
          >
            <ChannelIcon platform={id} size="sm" />
          </button>
        ))}
      </div>

      <div className="rounded-panel border border-line bg-bg-sub p-4">
        {platform === null ? (
          <p className="py-16 text-center text-[13px] text-subtle">
            Pick a channel to see the post as it will appear.
          </p>
        ) : (
          <div className="mx-auto w-full max-w-[360px]">
            <PostMock
              platform={platform}
              body={body}
              media={media}
              format={format}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PostMock(props: MockProps) {
  switch (props.platform) {
    case "instagram":
      return <InstagramMock {...props} />;
    case "facebook":
      return <FacebookMock {...props} />;
    case "x":
      return <XMock {...props} />;
    case "linkedin":
      return <LinkedInMock {...props} />;
    case "tiktok":
      return <TikTokMock {...props} />;
    case "youtube":
      return <YouTubeMock {...props} />;
    case "pinterest":
      return <PinterestMock {...props} />;
    case "threads":
      return <ThreadsMock {...props} />;
  }
}

/* ---------- shared pieces ---------- */

function identity(platform: PlatformId) {
  const channel = demoChannels.find((item) => item.platform === platform);
  return {
    name: demoWorkspace.name,
    handle: channel?.handle ?? `@${demoWorkspace.slug}`,
    followers: channel?.followers ?? 4_200,
  };
}

/** Deterministic vanity numbers so the mock never flickers between renders. */
function engagement(followers: number) {
  return {
    likes: Math.round(followers * 0.086),
    comments: Math.round(followers * 0.0072),
    shares: Math.round(followers * 0.0031),
    views: Math.round(followers * 1.64),
  };
}

function Avatar({
  platform,
  className,
}: {
  platform: PlatformId;
  className?: string;
}) {
  const spec = getPlatform(platform);
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-bold",
        className,
      )}
      style={{
        color: spec.hex,
        backgroundColor: `color-mix(in srgb, ${spec.hex} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${spec.hex} 32%, transparent)`,
      }}
      aria-hidden
    >
      {initials(demoWorkspace.name)}
    </span>
  );
}

function MediaFrame({
  platform,
  media,
  format,
  aspect,
  className,
}: {
  platform: PlatformId;
  media: readonly MediaItem[];
  format: PostFormat;
  aspect: string;
  className?: string;
}) {
  const spec = getPlatform(platform);
  const first = media[0];
  const isVideo = first?.kind === "video" || (!first && isVideoFormat(format));

  return (
    <div
      className={cn("relative overflow-hidden bg-surface-3", className)}
      style={{ aspectRatio: aspect }}
    >
      {first ? (
        first.kind === "image" ? (
          // Local object URLs cannot be routed through the image optimiser.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={first.url} alt="" className="size-full object-cover" />
        ) : (
          <video
            src={first.url}
            muted
            playsInline
            className="size-full object-cover"
          />
        )
      ) : (
        <div
          className="grid size-full place-items-center"
          style={{
            background: `linear-gradient(140deg, color-mix(in srgb, ${spec.hex} 20%, transparent), color-mix(in srgb, ${spec.hex} 4%, transparent))`,
          }}
        >
          <div className="text-center">
            <ImagePlus className="mx-auto size-5 text-subtle" />
            <p className="mt-1.5 px-4 text-[11px] text-subtle">
              {isVideo ? "Video slot" : "Image slot"} · {aspect.replace(" / ", ":")}
            </p>
          </div>
        </div>
      )}

      {isVideo ? (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-11 place-items-center rounded-full bg-black/45 backdrop-blur-sm">
            <Play className="size-5 fill-white text-white" />
          </span>
        </span>
      ) : null}

      {media.length > 1 || (format === "carousel" && media.length === 0) ? (
        <span className="absolute right-2.5 bottom-2.5 flex gap-1 rounded-full bg-black/45 px-2 py-1">
          {Array.from({ length: Math.max(3, media.length) }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "size-1 rounded-full",
                index === 0 ? "bg-white" : "bg-white/45",
              )}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}

const TOKEN_PATTERN = /^[#@][\p{L}\p{N}_]+$/u;

function RichText({
  text,
  clamp,
  className,
}: {
  text: string;
  clamp?: number;
  className?: string;
}) {
  const trimmedForDisplay =
    clamp !== undefined && text.length > clamp
      ? text.slice(0, text.lastIndexOf(" ", clamp) > 0 ? text.lastIndexOf(" ", clamp) : clamp)
      : text;
  const truncated = trimmedForDisplay.length < text.length;

  if (text.trim().length === 0) {
    return (
      <span className={cn("text-subtle italic", className)}>
        Your caption shows up here.
      </span>
    );
  }

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {trimmedForDisplay.split(/(\s+)/).map((token, index) =>
        TOKEN_PATTERN.test(token) ? (
          <span key={index} className="text-info">
            {token}
          </span>
        ) : (
          token
        ),
      )}
      {truncated ? <span className="text-subtle">… more</span> : null}
    </span>
  );
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 text-subtle [&_svg]:size-[18px]">
      {children}
    </div>
  );
}

/* ---------- per-network mocks ---------- */

function InstagramMock({ platform, body, media, format }: MockProps) {
  const who = identity(platform);
  const stats = engagement(who.followers);

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface shadow-e2">
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar platform={platform} className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">
            {who.handle.replace(/^@/, "")}
          </p>
          <p className="text-[11px] text-subtle">Sponsored · Stockholm</p>
        </div>
        <Ellipsis className="size-4 text-muted" />
      </header>

      <MediaFrame
        platform={platform}
        media={media}
        format={format}
        aspect="4 / 5"
      />

      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between">
          <ActionRow>
            <Heart />
            <MessageCircle />
            <Send />
          </ActionRow>
          <Bookmark className="size-[18px] text-subtle" />
        </div>
        <p className="mt-2.5 text-[13px] font-semibold tabular">
          {stats.likes.toLocaleString()} likes
        </p>
        <p className="mt-1 text-[13px] leading-snug">
          <span className="font-semibold">{who.handle.replace(/^@/, "")}</span>{" "}
          <RichText text={body} clamp={125} />
        </p>
        <p className="mt-1.5 text-[12px] text-subtle">
          View all {stats.comments.toLocaleString()} comments
        </p>
        <p className="mt-1 text-[10.5px] tracking-wide text-subtle uppercase">
          2 hours ago
        </p>
      </div>
    </article>
  );
}

function FacebookMock({ platform, body, media, format }: MockProps) {
  const who = identity(platform);
  const stats = engagement(who.followers);

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface shadow-e2">
      <header className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2">
        <Avatar platform={platform} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{who.name}</p>
          <p className="flex items-center gap-1 text-[11.5px] text-subtle">
            2h · <Globe className="size-3" />
          </p>
        </div>
        <Ellipsis className="size-4 text-muted" />
      </header>

      <p className="px-3.5 pb-3 text-[13.5px] leading-relaxed">
        <RichText text={body} clamp={250} />
      </p>

      <MediaFrame
        platform={platform}
        media={media}
        format={format}
        aspect="1 / 1"
      />

      <div className="flex items-center justify-between px-3.5 py-2 text-[12px] text-subtle">
        <span className="flex items-center gap-1.5">
          <span className="grid size-4 place-items-center rounded-full bg-ch-facebook text-[9px] text-white">
            <ThumbsUp className="size-2.5" />
          </span>
          {stats.likes.toLocaleString()}
        </span>
        <span className="tabular">
          {stats.comments.toLocaleString()} comments ·{" "}
          {stats.shares.toLocaleString()} shares
        </span>
      </div>

      <div className="grid grid-cols-3 border-t border-line">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Share2, label: "Share" },
        ].map((action) => (
          <span
            key={action.label}
            className="flex items-center justify-center gap-1.5 py-2 text-[12.5px] font-medium text-muted"
          >
            <action.icon className="size-4" />
            {action.label}
          </span>
        ))}
      </div>
    </article>
  );
}

function XMock({ platform, body, media, format }: MockProps) {
  const who = identity(platform);
  const stats = engagement(who.followers);

  return (
    <article className="rounded-card border border-line bg-surface p-3.5 shadow-e2">
      <div className="flex gap-2.5">
        <Avatar platform={platform} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13.5px]">
            <span className="truncate font-bold">{who.name}</span>
            <span className="truncate text-subtle">{who.handle} · 2h</span>
            <Ellipsis className="ml-auto size-4 shrink-0 text-subtle" />
          </p>

          <p className="mt-1 text-[14px] leading-snug">
            <RichText text={body} />
          </p>

          <MediaFrame
            platform={platform}
            media={media}
            format={format}
            aspect="16 / 9"
            className="mt-2.5 rounded-xl border border-line"
          />

          <div className="mt-3 flex items-center justify-between pr-2 font-mono text-[11.5px] text-subtle tabular [&_svg]:size-4">
            <span className="flex items-center gap-1.5">
              <MessageCircle />
              {compactNumber(stats.comments)}
            </span>
            <span className="flex items-center gap-1.5">
              <Repeat2 />
              {compactNumber(stats.shares)}
            </span>
            <span className="flex items-center gap-1.5">
              <Heart />
              {compactNumber(stats.likes)}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye />
              {compactNumber(stats.views)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function LinkedInMock({ platform, body, media, format }: MockProps) {
  const who = identity(platform);
  const stats = engagement(who.followers);

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface shadow-e2">
      <header className="flex items-start gap-2.5 px-3.5 pt-3.5 pb-2">
        <Avatar platform={platform} className="size-10 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{who.name}</p>
          <p className="truncate text-[11.5px] text-subtle">
            Family media studio · {compactNumber(who.followers)} followers
          </p>
          <p className="flex items-center gap-1 text-[11.5px] text-subtle">
            2h · <Globe className="size-3" />
          </p>
        </div>
        <Ellipsis className="size-4 text-muted" />
      </header>

      <p className="px-3.5 pb-3 text-[13.5px] leading-relaxed">
        <RichText text={body} clamp={210} />
      </p>

      <MediaFrame
        platform={platform}
        media={media}
        format={format}
        aspect="1.91 / 1"
      />

      <div className="flex items-center justify-between px-3.5 py-2 text-[11.5px] text-subtle tabular">
        <span>{stats.likes.toLocaleString()} reactions</span>
        <span>{stats.comments.toLocaleString()} comments</span>
      </div>

      <div className="grid grid-cols-4 border-t border-line">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map((action) => (
          <span
            key={action.label}
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted"
          >
            <action.icon className="size-4" />
            {action.label}
          </span>
        ))}
      </div>
    </article>
  );
}

function TikTokMock({ platform, body, media, format }: MockProps) {
  const who = identity(platform);
  const stats = engagement(who.followers);

  return (
    <article className="relative overflow-hidden rounded-card border border-line shadow-e2">
      <MediaFrame
        platform={platform}
        media={media}
        format={format}
        aspect="9 / 16"
      />

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-3 pt-14">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1 text-white">
            <p className="text-[13px] font-bold">{who.handle}</p>
            <p className="mt-1 text-[12.5px] leading-snug">
              <RichText text={body} clamp={100} className="text-white/90" />
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-white/80">
              <Music2 className="size-3" />
              original sound — {who.handle}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3.5 pb-1 text-white [&_svg]:size-6">
            <span className="flex flex-col items-center gap-0.5">
              <Heart className="fill-white/90" />
              <span className="font-mono text-[10.5px] tabular">
                {compactNumber(stats.likes)}
              </span>
            </span>
            <span className="flex flex-col items-center gap-0.5">
              <MessageCircle />
              <span className="font-mono text-[10.5px] tabular">
                {compactNumber(stats.comments)}
              </span>
            </span>
            <span className="flex flex-col items-center gap-0.5">
              <Bookmark />
              <span className="font-mono text-[10.5px] tabular">
                {compactNumber(stats.shares)}
              </span>
            </span>
            <Share2 />
          </div>
        </div>
      </div>
    </article>
  );
}

function YouTubeMock({ platform, body, media, format }: MockProps) {
  const who = identity(platform);
  const stats = engagement(who.followers);
  const short = format === "short";
  const [title, ...rest] = body.split("\n");
  const description = rest.join(" ").trim();

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface shadow-e2">
      <div className="relative">
        <MediaFrame
          platform={platform}
          media={media}
          format={format}
          aspect={short ? "9 / 16" : "16 / 9"}
        />
        <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10.5px] text-white tabular">
          {short ? "0:42" : "8:24"}
        </span>
      </div>

      <div className="flex gap-2.5 p-3">
        <Avatar platform={platform} className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13.5px] leading-snug font-semibold">
            {title.trim().length > 0 ? title : "Untitled video"}
          </p>
          <p className="mt-1 text-[11.5px] text-subtle">
            {who.handle} · {compactNumber(stats.views)} views · 2 hours ago
          </p>
          {description.length > 0 ? (
            <p className="mt-1.5 text-[12px] text-muted">
              <RichText text={description} clamp={90} />
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PinterestMock({ platform, body, media, format }: MockProps) {
  const who = identity(platform);
  const stats = engagement(who.followers);
  const [title] = body.split("\n");

  return (
    <article className="mx-auto w-[240px]">
      <div className="relative">
        <MediaFrame
          platform={platform}
          media={media}
          format={format}
          aspect="2 / 3"
          className="rounded-2xl"
        />
        <span className="absolute top-2.5 right-2.5 rounded-full bg-ch-pinterest px-3 py-1.5 text-[12px] font-semibold text-white">
          Save
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] leading-snug font-semibold">
        {title.trim().length > 0 ? title : "Untitled pin"}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Avatar platform={platform} className="size-6 text-[10px]" />
        <span className="truncate text-[11.5px] text-subtle">{who.name}</span>
        <span className="ml-auto font-mono text-[11px] text-subtle tabular">
          {compactNumber(stats.shares)} saves
        </span>
      </div>
    </article>
  );
}

function ThreadsMock({ platform, body, media, format }: MockProps) {
  const who = identity(platform);
  const stats = engagement(who.followers);

  return (
    <article className="rounded-card border border-line bg-surface p-3.5 shadow-e2">
      <div className="flex gap-2.5">
        <div className="flex flex-col items-center gap-1.5">
          <Avatar platform={platform} />
          <span className="w-px flex-1 bg-line" />
        </div>

        <div className="min-w-0 flex-1 pb-1">
          <p className="flex items-center gap-1.5 text-[13.5px]">
            <span className="truncate font-semibold">
              {who.handle.replace(/^@/, "")}
            </span>
            <span className="ml-auto text-[11.5px] text-subtle">2h</span>
            <Ellipsis className="size-4 shrink-0 text-subtle" />
          </p>

          <p className="mt-1 text-[13.5px] leading-snug">
            <RichText text={body} clamp={200} />
          </p>

          <MediaFrame
            platform={platform}
            media={media}
            format={format}
            aspect="4 / 5"
            className="mt-2.5 rounded-xl border border-line"
          />

          <div className="mt-2.5">
            <ActionRow>
              <Heart />
              <MessageCircle />
              <Repeat2 />
              <Send />
            </ActionRow>
          </div>

          <p className="mt-2 font-mono text-[11.5px] text-subtle tabular">
            {compactNumber(stats.comments)} replies ·{" "}
            {compactNumber(stats.likes)} likes
          </p>
        </div>
      </div>
    </article>
  );
}
