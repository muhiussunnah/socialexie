import type { PlatformId } from "@/lib/platforms";

/**
 * Content for the per-network "repurpose your own video" tool pages.
 *
 * These pages exist to rank for high-intent creator queries and convert that
 * traffic into sign-ups — so every page is a genuine, substantial guide to
 * getting more mileage out of videos the creator already made and owns, with
 * the working repurpose tool embedded after the opening sections. Nothing here
 * encourages taking content that isn't yours; the whole premise is your own
 * library.
 */

export interface ToolSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolPage {
  slug: string;
  platform: PlatformId;
  platformName: string;
  metaTitle: string;
  metaDescription: string;
  badge: string;
  h1: string;
  subhead: string;
  intro: string[];
  beforeTool: ToolSection[];
  afterTool: ToolSection[];
  faq: ToolFaq[];
  entities: string[];
  updated: string;
}

const UPDATED = "2026-08-05";

export const TOOL_PAGES: readonly ToolPage[] = [
  {
    slug: "tiktok-video-repurposer",
    platform: "tiktok",
    platformName: "TikTok",
    metaTitle: "TikTok Video Repurposer — Save & Reschedule Your Own Clips Free",
    metaDescription:
      "Turn one TikTok you made into a week of posts across every network. Free caption generator, specs, and a step-by-step repurposing workflow for creators.",
    badge: "Free TikTok tool",
    h1: "Repurpose your own TikToks into everything, everywhere.",
    subhead:
      "You already did the hard part — you made the video. Get ten times the reach from it by reshaping it for every other network, on a schedule, from one desk.",
    intro: [
      `Every TikTok you post is a small production: the idea, the shoot, the edit, the hook, the caption. Then the algorithm shows it to a slice of your followers for a day or two and moves on. The single highest-leverage thing most creators never do is give that same video a second, third and fourth life — as an Instagram Reel, a YouTube Short, a Facebook Reel, a Pinterest idea pin — instead of starting a brand-new post from scratch every single day.`,
      `This page is a free, practical guide to repurposing the TikToks you already own: what to change for each network, the specs that actually matter, the hooks and captions that travel, and a repeatable workflow you can run in minutes. The tool below writes native TikTok captions and hooks for your video in seconds so you never stare at an empty caption box again.`,
    ],
    beforeTool: [
      {
        heading: "What 'repurposing' really means (and what it doesn't)",
        paragraphs: [
          `Repurposing is not blindly re-uploading the exact same file to five apps and hoping. Each network reads engagement, watch-through and native-feel differently, and a video that obviously came from somewhere else — visible TikTok watermark, wrong aspect ratio, a caption written for a different audience — gets quietly throttled. Real repurposing means keeping the good idea and re-fitting the wrapper: the crop, the length, the on-screen text safe zones, the caption, the hashtags and the call to action.`,
          `The goal is one shoot, many native posts. A 22-second TikTok tip becomes a tighter Reel, a punchier Short, a Facebook Reel with a longer caption for an older audience, and a carousel of the three best frames with a "save this" hook. Same footage, five audiences, five chances to travel — and none of it looks recycled.`,
        ],
      },
      {
        heading: "TikTok specs that actually matter when you repurpose",
        paragraphs: [
          `Before a clip leaves TikTok for anywhere else, get the format right so it feels native at the destination. TikTok itself is vertical 9:16 at 1080×1920, and that full-frame vertical is exactly what Reels and Shorts want too — which is why TikTok is the best source video in most creators' libraries.`,
        ],
        bullets: [
          "Aspect ratio: 1080×1920 (9:16) vertical — the universal short-form canvas.",
          "Length: 15–34 seconds travels furthest; keep the hook in the first 2 seconds.",
          "Safe zones: keep text and faces out of the bottom 15% and right 10% where captions and UI sit.",
          "No burned-in watermark: export a clean master so the destination network doesn't down-rank an obvious repost.",
          "Captions/subtitles: on-screen text lifts watch-through — but re-render it per platform so it never overlaps native UI.",
        ],
      },
    ],
    afterTool: [
      {
        heading: "The 5-step workflow: one TikTok, a week of posts",
        paragraphs: [
          `A tight, boring, repeatable process beats inspiration. Here is the loop creators use to turn a single TikTok into a full week of native content without re-shooting anything.`,
        ],
        bullets: [
          "1. Pull the clean master. Keep a watermark-free export of every TikTok you post — that file is the raw material for everything else.",
          "2. Rewrite the wrapper per network. New caption, new first line, new hashtags. The tool above does this in seconds; you pick the best.",
          "3. Reformat, don't re-shoot. Trim to the platform's sweet-spot length and re-add subtitles inside that platform's safe zone.",
          "4. Spin off adjacent posts. Screenshot the three strongest frames into a carousel; pull one line into a text post; save one quote for a Story.",
          "5. Schedule the whole set. Queue every version across the week so one shoot feeds days of the calendar, not one afternoon.",
        ],
      },
      {
        heading: "Hooks and captions that travel off TikTok",
        paragraphs: [
          `The hook is the whole game. On TikTok you can lean on trending audio and fast cuts; on a Reel or Short the first line of on-screen text and the caption do more of the lifting. When you move a video, rewrite the first two seconds for the new room. "Wait for it" works on TikTok; on YouTube Shorts a concrete promise ("3 things nobody tells you about a 3-year-old") holds longer.`,
          `Captions should match the audience, not the app you copied from. TikTok captions are short and playful; the same video on Facebook can carry two or three warm sentences for an older, slower-scrolling audience. Keep the idea, change the voice — the generator above gives you a spread of options tuned to each network so you're choosing, not writing from zero.`,
        ],
      },
      {
        heading: "Cross-posting TikTok the right way",
        paragraphs: [
          `TikTok is the ideal hub for a short-form strategy because its native format is the lowest common denominator: vertical, fast, hook-first. From one TikTok you can feed Instagram Reels, YouTube Shorts, Facebook Reels and Pinterest with minimal reformatting, and a longer horizontal cut can even seed a full YouTube video or a LinkedIn clip.`,
          `The mistake is treating cross-posting as a copy-paste. Each network rewards native behaviour: fresh captions, platform-appropriate hashtags, correct posting times for that audience's timezone, and no competitor-app watermark. Do that and the same footage compounds; skip it and the reposts sink.`,
        ],
      },
      {
        heading: "How Socialexie repurposes for you",
        paragraphs: [
          `Doing all of this by hand — export, rewrite, reformat, reschedule across eight apps — is exactly the busywork Socialexie removes. You bring your own video, the composer shapes one draft per network and checks it against each platform's real limits before it can be scheduled, the AI studio writes the captions and hooks, evergreen recycling puts your best clips back into rotation automatically, and a timezone-aware queue sends everything out at the right local time.`,
          `Your content stays yours: workspace data is isolated with database-level security, every channel connects through its own official API, and nothing you upload is used to train models. Start free on two channels — bring one TikTok and watch it become a week of posts.`,
        ],
      },
    ],
    faq: [
      {
        q: "Is it legal to repurpose my own TikTok videos?",
        a: "Yes — repurposing content you created and own is completely fine and is standard practice for creators. This tool is built around your own library: your videos, reshaped for other networks you control. It is not for downloading other people's content.",
      },
      {
        q: "How do I get a clean, watermark-free copy of my own TikTok?",
        a: "Keep the original export from your editor before you upload to TikTok — that clean master is what you repurpose. Save every video you make into a library so you always have the source file, which is exactly what Socialexie's media library is for.",
      },
      {
        q: "What's the best length when I move a TikTok to Reels or Shorts?",
        a: "15–34 seconds is the sweet spot across short-form. Keep the hook in the first two seconds and trim any dead time at the end so watch-through stays high on the new platform.",
      },
      {
        q: "Should I use the same caption on every platform?",
        a: "No. Keep the idea, change the voice and hashtags per network. TikTok captions are short and playful; the same video on Facebook can carry a warmer, longer caption. The generator above gives you native options for each.",
      },
      {
        q: "Will other platforms penalise a video with a TikTok watermark?",
        a: "They can down-rank obviously recycled content, so always post a clean export without a competitor-app watermark and re-add your own subtitles inside that platform's safe zone.",
      },
      {
        q: "How many posts can I really get from one TikTok?",
        a: "Realistically five to eight: a Reel, a Short, a Facebook Reel, a Pinterest pin, a carousel of the best frames, a text post pulling one line, and a Story. One shoot can feed most of a week.",
      },
      {
        q: "Do I need to pay to use the caption generator?",
        a: "Socialexie is free forever on two channels with no card required. Generating captions runs on your workspace's own AI key, and you can connect any provider — including free and low-cost models.",
      },
      {
        q: "Can Socialexie schedule the repurposed posts automatically?",
        a: "Yes. Once you've picked your captions, the composer queues each version across every connected network on a timezone-aware schedule, so one video fills days of your calendar in a couple of minutes.",
      },
    ],
    entities: [
      "TikTok",
      "Instagram Reels",
      "YouTube Shorts",
      "Facebook Reels",
      "Pinterest",
      "short-form video",
      "9:16 vertical",
      "content repurposing",
      "cross-posting",
      "social media scheduling",
      "watch-through rate",
      "creator workflow",
    ],
    updated: UPDATED,
  },

  {
    slug: "instagram-video-repurposer",
    platform: "instagram",
    platformName: "Instagram",
    metaTitle: "Instagram Reels Repurposer — Reschedule Your Own Videos Free",
    metaDescription:
      "Get more from every Reel you make. Free caption generator, Reels specs, and a workflow to repurpose your own Instagram videos across every network.",
    badge: "Free Instagram tool",
    h1: "Turn one Instagram Reel into a week of posts.",
    subhead:
      "Your Reels deserve more than 48 hours in the feed. Reshape the videos you already own for every network and put your best ones back into rotation.",
    intro: [
      `Instagram rewards consistency more than almost any network — and consistency is exhausting when every post starts from a blank canvas. The fix isn't posting more raw content; it's getting more out of the Reels you already made. A single strong Reel can become a TikTok, a YouTube Short, a Facebook Reel, a carousel and a Story, and the same Reel can be re-shared weeks later to an audience that never saw it the first time.`,
      `This is a free, practical guide to repurposing your own Instagram videos: the Reels and feed specs that matter, the caption and hook patterns that carry across networks, and a workflow you can repeat in minutes. The tool below writes native Instagram captions and hooks for your video instantly so the caption is never the thing that slows you down.`,
    ],
    beforeTool: [
      {
        heading: "Why repurposing beats posting more",
        paragraphs: [
          `Reach on Instagram is spiky: a Reel does most of its work in the first day or two, then tails off, even if it was good. Making a brand-new Reel every day to feed that curve leads straight to burnout and thin content. Repurposing flips the maths — one well-made video, reshaped for four other networks and re-queued as evergreen, quietly outperforms four rushed originals.`,
          `It also protects quality. When you're not scrambling to fill the calendar, each idea gets the shoot and edit it deserves, and then earns its keep many times over. The creators who look impossibly consistent aren't making more; they're squeezing more out of every good thing they make.`,
        ],
      },
      {
        heading: "Instagram specs to get right before you repurpose",
        paragraphs: [
          `Instagram now leans almost entirely on Reels for reach, so treat the vertical Reel as your master format and adapt from there. Feed video and carousels are still powerful for saves, which are one of Instagram's strongest ranking signals.`,
        ],
        bullets: [
          "Reels: 1080×1920 (9:16) vertical, up to 90 seconds, hook in the first 2 seconds.",
          "Feed video / carousel: 1080×1350 (4:5) portrait uses the most screen real estate in-feed.",
          "Safe zones: keep text and faces out of the bottom ~15% and top ~10% where the caption and UI sit.",
          "Cover frame: pick a clean, high-contrast cover — it's the first thing people judge on your grid.",
          "Captions: subtitles boost watch-through; Instagram auto-captions exist, but styled on-screen text you control travels better when you cross-post.",
        ],
      },
    ],
    afterTool: [
      {
        heading: "The 5-step workflow: one Reel, a week of posts",
        paragraphs: [
          `Run the same loop every time and repurposing stops being a project and becomes a habit.`,
        ],
        bullets: [
          "1. Keep the clean master. Save a watermark-free export of every Reel into a library — that's your raw material.",
          "2. Rewrite per network. Fresh caption, fresh first line, fresh hashtags. The tool above gives you native options in seconds.",
          "3. Reformat, don't re-shoot. Trim to each platform's sweet spot and re-add subtitles inside the safe zone.",
          "4. Spin off adjacent posts. Turn the three best frames into a carousel; pull a quote into a Story; lift one line into a text post.",
          "5. Schedule + recycle. Queue every version this week, and set the best evergreen Reels to re-share automatically weeks later.",
        ],
      },
      {
        heading: "Captions and hooks that carry across networks",
        paragraphs: [
          `Instagram captions do double duty: the first line is a hook that decides whether people tap "more," and the whole caption drives saves and shares. When you repurpose a Reel, don't paste the Instagram caption onto TikTok or a Short — rewrite the first line for that room and trim the hashtags to what each network actually rewards.`,
          `A save-worthy caption usually promises something concrete ("save this for the next tantrum") or opens a loop the video closes. The generator above produces a spread of native options — pick the one that fits the platform and your voice, and keep the idea consistent even as the wording changes.`,
        ],
      },
      {
        heading: "Cross-posting Instagram the right way",
        paragraphs: [
          `A vertical Reel is nearly plug-and-play for TikTok, YouTube Shorts and Facebook Reels — but "nearly" is where reach is won or lost. Export without the Instagram watermark, re-render subtitles per platform, swap the caption and hashtags, and post at the right local time for each audience.`,
          `Feed carousels repurpose beautifully too: the same three-slide "save this" idea works as a Pinterest pin set and a LinkedIn document post. One idea, several formats, several audiences — as long as each one feels native rather than forwarded.`,
        ],
      },
      {
        heading: "How Socialexie repurposes for you",
        paragraphs: [
          `Socialexie turns this whole routine into a couple of clicks. Upload the Reel you already made, and the composer shapes one draft per network, checks it against each platform's real rules before scheduling, and the AI studio writes the captions and hooks. Evergreen recycling puts your strongest Reels back into rotation on a cadence you set, and the timezone-aware queue publishes everything at the right local moment.`,
          `Every channel connects through Instagram's and each network's official API — no password sharing, no browser automation — and your content and data stay isolated to your workspace. Start free on two channels and let one Reel do a week's work.`,
        ],
      },
    ],
    faq: [
      {
        q: "Is it okay to repurpose my own Instagram Reels to other apps?",
        a: "Absolutely — reusing content you made and own is normal and encouraged. This tool works from your own library and reshapes your videos for networks you control. It is not for grabbing other accounts' content.",
      },
      {
        q: "What's the ideal Reel length to repurpose across networks?",
        a: "Short wins across the board: 15–34 seconds travels furthest to TikTok and Shorts. Reels themselves allow up to 90 seconds, but keep the hook in the first two seconds regardless.",
      },
      {
        q: "How do I avoid the Instagram watermark when cross-posting?",
        a: "Export the original from your editor before uploading to Instagram, or keep a clean master in your library. Post that clean file elsewhere and add your own subtitles so nothing looks recycled.",
      },
      {
        q: "Should the caption be the same everywhere?",
        a: "No — keep the idea, rewrite the first line and hashtags per network. Instagram captions can be longer and save-driven; a Short needs a tighter, promise-first hook. The generator gives you options for each.",
      },
      {
        q: "What makes an Instagram caption get saves?",
        a: "Saves come from utility and emotion: a concrete promise ('save this for later'), a list people want to keep, or a line that names exactly how someone feels. Put that value in the first line.",
      },
      {
        q: "Can I re-share my old Reels automatically?",
        a: "Yes. Socialexie's evergreen recycling re-queues your best-performing videos on a schedule you control, so proven content keeps reaching new followers without you touching it.",
      },
      {
        q: "Do I need a Business or Creator account?",
        a: "To publish to Instagram through the official API you need a Business or Creator account linked to a Facebook Page. The repurposing tool and caption generator work regardless of account type.",
      },
      {
        q: "Is the caption generator free?",
        a: "Yes — Socialexie is free on two channels with no card, and captions run on your own connected AI key, so you control the cost and can use free models.",
      },
    ],
    entities: [
      "Instagram",
      "Instagram Reels",
      "carousels",
      "Stories",
      "TikTok",
      "YouTube Shorts",
      "Facebook Reels",
      "9:16 vertical",
      "4:5 portrait",
      "content repurposing",
      "evergreen recycling",
      "saves and shares",
    ],
    updated: UPDATED,
  },

  {
    slug: "youtube-video-repurposer",
    platform: "youtube",
    platformName: "YouTube",
    metaTitle: "YouTube Video Repurposer — Turn Your Videos Into Shorts & Posts",
    metaDescription:
      "Repurpose your own YouTube videos and Shorts into clips for every network. Free caption and hook generator, specs, and a proven creator workflow.",
    badge: "Free YouTube tool",
    h1: "Repurpose your own YouTube videos into Shorts and everything else.",
    subhead:
      "One long video holds a dozen short ones. Cut, caption and reschedule the content you already own across every network — from a single desk.",
    intro: [
      `A single YouTube video is the richest raw material a creator has. Inside a ten-minute upload are five or six standalone moments that each work as a Short, a Reel, a TikTok or a Facebook Reel — and every one of those is a new front door back to the full video. The creators who grow fastest aren't uploading more long videos; they're mining the ones they already made for short-form clips and posting them everywhere.`,
      `This free guide covers repurposing your own YouTube content the right way: which moments to cut, the Shorts and long-form specs that matter, the titles and hooks that travel, and a repeatable workflow. The tool below writes native YouTube titles, hooks and captions for your clip in seconds so packaging never becomes the bottleneck.`,
    ],
    beforeTool: [
      {
        heading: "Every long video is a dozen short ones",
        paragraphs: [
          `The highest-leverage habit on YouTube is treating each long upload as a source, not a finished product. A tutorial has three or four "aha" moments; a vlog has a handful of funny or emotional beats; an interview has quotable answers. Each of those, cut to 20–40 seconds with a strong first line, becomes a Short — and Shorts are the cheapest reach on the platform right now.`,
          `Then those same clips leave YouTube entirely: the vertical Short is ready for Reels, TikTok and Facebook Reels with minimal reformatting, and a horizontal cut can seed a LinkedIn post. One video you already published can quietly generate a week of short-form across five networks.`,
        ],
      },
      {
        heading: "YouTube specs to get right before you repurpose",
        paragraphs: [
          `Shorts and long-form are different canvases; repurpose into whichever fits the moment, and keep a clean master so the clip feels native wherever it lands.`,
        ],
        bullets: [
          "Shorts: 1080×1920 (9:16) vertical, up to 60 seconds, hook in the first 2 seconds, #Shorts helps categorisation.",
          "Long-form: 1920×1080 (16:9), with the first 30 seconds doing the heavy lifting for retention.",
          "Titles: front-load the promise — the first few words decide the click on browse and search.",
          "Captions/subtitles: burned-in captions lift Shorts watch-through and make the clip work with sound off elsewhere.",
          "Thumbnails: for long-form, a clear high-contrast thumbnail is half the battle; export a strong cover frame for Shorts too.",
        ],
      },
    ],
    afterTool: [
      {
        heading: "The 5-step workflow: one video, a week of clips",
        paragraphs: [
          `The same loop turns every upload into a short-form engine you can run in an afternoon.`,
        ],
        bullets: [
          "1. Mark the moments. As you review the upload, note every 20–40 second beat that stands alone.",
          "2. Cut vertical clips. Reframe each moment to 9:16, trim to the hook, and add burned-in captions.",
          "3. Package each clip. Write a native title, first line and caption — the tool above does this per clip in seconds.",
          "4. Spin off adjacent posts. Pull a quote into a text post; turn a list moment into a carousel; grab a frame for a Pinterest pin.",
          "5. Schedule everywhere. Queue the Shorts plus the Reel/TikTok/Facebook versions across the week, each at the right local time.",
        ],
      },
      {
        heading: "Titles, hooks and captions that travel",
        paragraphs: [
          `On YouTube the title and first line carry more weight than almost anywhere. A concrete, curiosity-shaped promise ("3 things nobody tells you about a 3-year-old") beats a vague one every time, and that same promise becomes the on-screen hook when the clip moves to Reels or TikTok. Rewrite the first two seconds for each destination — a Short can lean on the title text, a Reel needs the hook baked into the video.`,
          `Captions off YouTube should match the destination's audience and length. The generator above gives you a spread of titles, hooks and captions tuned per network, so you keep one idea and dress it correctly for each room instead of reusing YouTube packaging that falls flat elsewhere.`,
        ],
      },
      {
        heading: "Cross-posting YouTube the right way",
        paragraphs: [
          `A vertical Short is ready-made for Instagram Reels, TikTok and Facebook Reels — export it clean (no #Shorts burned in, no YouTube UI captured), re-render subtitles, swap the caption and post at the right local time. A horizontal clip from a long video can seed LinkedIn or an X post with a different, professional framing.`,
          `The reverse is powerful too: a strong TikTok or Reel you already made is an easy Short, and the Short links viewers back to your long-form catalogue. Treat YouTube as both a source of clips and a destination for them, and every network feeds the others.`,
        ],
      },
      {
        heading: "How Socialexie repurposes for you",
        paragraphs: [
          `Socialexie removes the packaging-and-scheduling grind. Bring the clip you cut from your own video, and the composer shapes one draft per network, checks each against the platform's real rules before scheduling, and the AI studio writes the titles, hooks and captions. Evergreen recycling re-surfaces your best Shorts automatically, and the timezone-aware queue publishes each version at the right local moment across every connected channel.`,
          `Connections use YouTube's and each network's official API, your uploads are never used to train models, and workspace data is isolated with database-level security. Start free on two channels and turn one upload into a week of short-form.`,
        ],
      },
    ],
    faq: [
      {
        q: "Can I repurpose my own YouTube videos into Shorts and other apps?",
        a: "Yes — cutting your own long videos into Shorts and clips for other networks is a core growth strategy and completely fine, because it's your content. This tool is built around your own catalogue, not anyone else's.",
      },
      {
        q: "How long should a Short cut from a long video be?",
        a: "20–40 seconds is ideal. Find a moment that stands alone, open on the strongest line, and cut any lead-in so the hook lands in the first two seconds.",
      },
      {
        q: "How many Shorts can I get from one long video?",
        a: "Most 8–12 minute videos hold five or six standalone moments. Each becomes a Short, and each Short also travels to Reels, TikTok and Facebook — so one upload can fill a week.",
      },
      {
        q: "Do I need a clean export to cross-post a Short elsewhere?",
        a: "Yes. Post a clean vertical file without #Shorts burned in or YouTube UI captured, and re-add your own subtitles so the clip feels native on the destination network.",
      },
      {
        q: "What makes a title or hook work across platforms?",
        a: "A concrete, curiosity-shaped promise. Front-load the payoff in the first few words, and rewrite that hook as on-screen text when the clip moves to Reels or TikTok.",
      },
      {
        q: "Can Socialexie publish Shorts and videos to YouTube for me?",
        a: "Yes, through YouTube's official API once your channel is connected. You can also schedule the Reel, TikTok and Facebook versions of the same clip in the same queue.",
      },
      {
        q: "Is the title and caption generator free?",
        a: "Socialexie is free on two channels with no card, and generation runs on your own connected AI key, so you control cost and can use free or low-cost models.",
      },
      {
        q: "Should I repurpose short-form back into YouTube?",
        a: "Definitely. A strong TikTok or Reel you already made is an easy Short, and it points new viewers to your long-form catalogue — the networks feed each other.",
      },
    ],
    entities: [
      "YouTube",
      "YouTube Shorts",
      "long-form video",
      "16:9",
      "9:16 vertical",
      "Instagram Reels",
      "TikTok",
      "Facebook Reels",
      "video titles",
      "thumbnails",
      "audience retention",
      "content repurposing",
    ],
    updated: UPDATED,
  },

  {
    slug: "facebook-video-repurposer",
    platform: "facebook",
    platformName: "Facebook",
    metaTitle: "Facebook Video Repurposer — Reschedule Your Own Videos Free",
    metaDescription:
      "Repurpose your own Facebook videos and Reels across every network. Free caption generator, specs, and a step-by-step workflow built for Pages and creators.",
    badge: "Free Facebook tool",
    h1: "Repurpose your own Facebook videos into every network.",
    subhead:
      "Facebook's audience skews older and reads more — the perfect place to give your videos a longer, warmer second life. Reshape what you own and schedule it everywhere.",
    intro: [
      `Facebook is where a lot of creators leave reach on the table. The audience is large, loyal and older, it reads captions instead of skimming them, and Facebook Reels are still under-served enough to over-deliver on reach for good short-form. If you're already making videos for TikTok or Instagram, the videos you own are the exact raw material a Facebook Page needs — reshaped for how people actually behave there.`,
      `This free guide covers repurposing your own videos onto Facebook and back out again: the Reels and feed-video specs that matter, the warmer caption style that works with an older audience, and a repeatable workflow. The tool below writes native Facebook captions and hooks for your video in seconds so the caption is never the reason a post sits unpublished.`,
    ],
    beforeTool: [
      {
        heading: "Why Facebook rewards repurposing",
        paragraphs: [
          `Facebook's feed behaves differently from short-form-first apps: people stop and read, comment threads run longer, and shares into groups and Messenger extend a post's life far beyond the first day. That means a video you made for TikTok can carry a longer, more heartfelt caption on Facebook and reach an audience that would never have found it on a fast-scrolling app.`,
          `Facebook Reels, meanwhile, are the same vertical format as everywhere else, so your existing short-form drops in with almost no reformatting — and because the surface is less saturated, well-made Reels frequently out-reach the identical clip elsewhere. Repurposing onto Facebook is often the single easiest reach a creator can add.`,
        ],
      },
      {
        heading: "Facebook specs to get right before you repurpose",
        paragraphs: [
          `Facebook supports both vertical Reels and feed video, so match the format to the goal — Reels for reach, feed video for an existing audience and comment-driven engagement.`,
        ],
        bullets: [
          "Reels: 1080×1920 (9:16) vertical, up to 90 seconds, hook in the first 2 seconds.",
          "Feed video: 1080×1080 (1:1) or 4:5 portrait perform well in a scrolling feed.",
          "Captions: burned-in subtitles matter — a large share of Facebook video is watched with sound off.",
          "First line of the caption: it's the hook before 'See more', so front-load the emotion or promise.",
          "Clean export: no competitor-app watermark, so the video reads as native to the Page.",
        ],
      },
    ],
    afterTool: [
      {
        heading: "The 5-step workflow: one video, a week of Facebook posts",
        paragraphs: [
          `Repurposing onto and off Facebook follows the same reliable loop.`,
        ],
        bullets: [
          "1. Keep the clean master. Save a watermark-free export of every video into a library.",
          "2. Warm up the caption. Facebook rewards two or three heartfelt sentences and a question — the tool above drafts these per network.",
          "3. Reformat for the surface. Vertical for a Reel, 1:1 or 4:5 for the feed, subtitles baked in for sound-off viewing.",
          "4. Spin off adjacent posts. Turn a moment into a photo post with a story; pull a line into a text update; save a clip for a group.",
          "5. Schedule + reply. Queue every version across the week, then reply to early comments — Facebook rewards active threads.",
        ],
      },
      {
        heading: "Captions and hooks for an audience that reads",
        paragraphs: [
          `The Facebook caption is doing more work than a TikTok caption ever does. People read the first line, decide whether to tap "See more," and comment when the post asks something real. So when you move a video to Facebook, don't paste the three-word TikTok caption — expand it into a warm, honest opening and end with a genuine question that invites replies.`,
          `A question that earns comments is worth more than any hashtag here, because comments and shares are what carry a Facebook post into new feeds. The generator above produces native, warmer Facebook options alongside the punchier short-form ones, so you keep the idea and match the room.`,
        ],
      },
      {
        heading: "Cross-posting to and from Facebook the right way",
        paragraphs: [
          `Your vertical Reels from TikTok, Instagram and YouTube drop straight into Facebook Reels — export clean, re-render subtitles, warm up the caption and post at the right local time. Feed video from Facebook can travel back the other way as a square or vertical clip with a tighter caption for faster apps.`,
          `Because Facebook connects a Page (and often a linked Instagram account) through Meta's official API, it fits naturally into a one-desk workflow: publish the Facebook Reel, the Instagram Reel, the TikTok and the Short from a single queue instead of four separate apps.`,
        ],
      },
      {
        heading: "How Socialexie repurposes for you",
        paragraphs: [
          `Socialexie makes Facebook the easy win it should be. Upload the video you already made, and the composer shapes a native Facebook draft — warmer caption, correct format — alongside versions for every other network, checks each against the platform's real rules, and the AI studio writes the captions and hooks. The timezone-aware queue publishes at the right local time, and evergreen recycling brings your best videos back for the audience that missed them.`,
          `Facebook and Instagram connect through Meta's official API — no password sharing, no browser automation — and your content and workspace data stay isolated and are never used to train models. Start free on two channels and give every video a second life where people actually stop to watch.`,
        ],
      },
    ],
    faq: [
      {
        q: "Can I repurpose my own videos onto my Facebook Page?",
        a: "Yes — posting your own content to your Page and reshaping it for other networks is completely fine and is exactly what this tool is for. It works from your own library, not other people's content.",
      },
      {
        q: "Do my TikToks and Reels work as Facebook Reels?",
        a: "Almost directly — Facebook Reels use the same 9:16 vertical format. Export a clean file without a competitor-app watermark, re-render subtitles, warm up the caption, and it drops right in.",
      },
      {
        q: "Why do Facebook captions need to be longer?",
        a: "Facebook's audience reads. A warmer two-or-three-sentence caption that ends in a real question earns comments and shares, which are what carry a post into new feeds — far more than hashtags do here.",
      },
      {
        q: "Should I add subtitles for Facebook?",
        a: "Yes. A large share of Facebook video is watched with the sound off, so burned-in subtitles noticeably lift watch-through and completion.",
      },
      {
        q: "What format is best for Facebook feed video?",
        a: "Square (1:1) and 4:5 portrait take up the most space in a scrolling feed. Use vertical 9:16 for Reels when reach is the goal.",
      },
      {
        q: "Can Socialexie post to both my Facebook Page and Instagram?",
        a: "Yes. Both connect through Meta's official API, so you can publish the Facebook and Instagram versions of the same video from one queue, along with every other connected network.",
      },
      {
        q: "Is the caption generator free to use?",
        a: "Socialexie is free on two channels with no card required, and generation runs on your own connected AI key, so you control the cost and can use free models.",
      },
      {
        q: "How do I stop good videos from disappearing after a day?",
        a: "Use evergreen recycling: Socialexie re-queues your best-performing videos automatically on a cadence you set, so proven content keeps reaching the Page's audience over time.",
      },
    ],
    entities: [
      "Facebook",
      "Facebook Reels",
      "Facebook Pages",
      "Meta",
      "Instagram",
      "feed video",
      "9:16 vertical",
      "1:1 square",
      "captions and subtitles",
      "content repurposing",
      "evergreen recycling",
      "audience engagement",
    ],
    updated: UPDATED,
  },
];

export function getToolPage(slug: string): ToolPage | undefined {
  return TOOL_PAGES.find((page) => page.slug === slug);
}
