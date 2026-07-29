import type { PlatformId } from "@/lib/platforms";

/**
 * Post template library.
 *
 * Each template names the action it is trying to earn, because the platforms
 * weight those actions very differently: shares and saves widen reach to
 * people who do not follow you, likes mostly do not.
 */

export type Goal = "comments" | "shares" | "saves" | "reach" | "leads";

export interface Template {
  id: string;
  name: string;
  goal: Goal;
  /** Why this shape works, in one sentence. */
  rationale: string;
  /** Fill-in-the-blank skeleton. `{{...}}` marks the parts to replace. */
  skeleton: string;
  /** A worked example so the shape is obvious at a glance. */
  example: string;
  bestFor: readonly PlatformId[];
  /**
   * Set when the format trades reach for engagement. The composer surfaces
   * this so nobody makes it their everyday post by accident.
   */
  caution?: string;
}

export const GOAL_LABEL: Record<Goal, string> = {
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  reach: "Reach",
  leads: "DM leads",
};

export const TEMPLATES: readonly Template[] = [
  {
    id: "confession",
    name: "Relatable confession",
    goal: "comments",
    rationale:
      "Naming an unglamorous truth gives people permission to admit the same thing, and 'me too' is the lowest-effort comment there is.",
    skeleton:
      "Confession: {{the thing you do that you feel bad about}}… and then I feel {{feeling}} about it.\nAnyone else? {{reassurance}}\n{{tiny next step}} — deal?",
    example:
      "Confession: some nights I fake-love bedtime stories so I can scroll in peace… and then I feel like garbage about it. Anyone else? You're not a bad parent, you're a tired one. Ten real minutes tomorrow — deal?",
    bestFor: ["facebook", "instagram", "threads"],
  },
  {
    id: "nobody-tells-you",
    name: "X things nobody tells you about…",
    goal: "saves",
    rationale:
      "A specific number and a specific stage sets an expectation the reader wants to finish, and lists are the format people bookmark.",
    skeleton:
      "{{number}} things nobody tells you about {{very specific situation}}.\n1. {{truth}}\n2. {{truth}}\n…\nSave this for {{the moment they'll need it}}.",
    example:
      "7 things nobody tells you about having a 3-year-old. 1. They will love you and rage at you in the same breath… Save this for the day you feel like you're failing.",
    bestFor: ["instagram", "linkedin", "facebook", "pinterest"],
  },
  {
    id: "save-this-list",
    name: "Save this list",
    goal: "saves",
    rationale:
      "Practical and skimmable. Saves are a strong quality signal and the post keeps working every time someone returns to it.",
    skeleton:
      "SAVE THIS — {{number}} {{useful things}}:\n1. {{item}}\n2. {{item}}\n…\n{{one line on when to use it}}",
    example:
      "SAVE THIS — 5 things to say instead of 'good job': 1. 'You worked really hard on that.' 2. 'Tell me about it!' … Bookmark it for tomorrow.",
    bestFor: ["instagram", "pinterest", "linkedin"],
  },
  {
    id: "tag-someone",
    name: "Tag someone who…",
    goal: "shares",
    rationale:
      "A tag puts the post in front of one specific person who is likely to care, which travels further than a generic ask.",
    skeleton:
      "Tag {{who}} who needs to hear this today: {{the message}}.",
    example:
      "Tag a parent who needs to hear this today: the laundry can wait, the dishes can wait — your kid asking you to play cannot.",
    bestFor: ["facebook", "instagram", "threads"],
    caution:
      "Explicit tag requests are treated as engagement bait and shown to fewer non-followers. Use sparingly.",
  },
  {
    id: "this-or-that",
    name: "This or that",
    goal: "comments",
    rationale:
      "Two options means the reader can answer in one character. Low effort in, high comment count out.",
    skeleton:
      "Would you rather: 🅰️ {{option A}} or 🅱️ {{option B}}?\nDrop A or B. {{playful aside}}",
    example:
      "Would you rather: 🅰️ a toddler who wakes at 5am but naps 3 hours, or 🅱️ sleeps till 7 but hasn't napped since 2022? Drop A or B — no wrong answers, only tired ones.",
    bestFor: ["facebook", "instagram", "x", "threads"],
  },
  {
    id: "fill-blank",
    name: "Fill in the blank",
    goal: "comments",
    rationale:
      "An unfinished sentence is an open loop. People complete it almost reflexively, especially when you answer first.",
    skeleton: "{{setup}} ______ {{and the consequence}}.\nGo. (I'll start: {{your answer}})",
    example:
      "My kid is currently obsessed with ______ and I'm slowly losing my mind about it. Go. (I'll start: the same 4-minute song, on loop, for 3 weeks.)",
    bestFor: ["facebook", "instagram", "threads", "x"],
  },
  {
    id: "gentle-opinion",
    name: "Gentle but shareable opinion",
    goal: "shares",
    rationale:
      "A mild, values-based take is something people share to say something about themselves — the strongest sharing motive there is.",
    skeleton:
      "Unpopular opinion: {{the take}}.\n{{the reframe}}.\nShare if you needed the reminder.",
    example:
      "Unpopular opinion: your kids won't remember the perfect birthday. They'll remember you on the floor, phone down, actually playing. Presence over perfection.",
    bestFor: ["facebook", "linkedin", "threads", "instagram"],
  },
  {
    id: "nostalgia",
    name: "Milestone nostalgia",
    goal: "shares",
    rationale:
      "Bittersweet beats happy for sharing. Naming a stage people are losing makes them want to hand it to someone in the same season.",
    skeleton:
      "One day {{the ordinary thing}} happens for the last time and you don't even know it's the last time.\nWhat's the stage you'd relive for one more day?",
    example:
      "One day they climb into your lap for the last time and you don't even know it's the last time. What stage would you give anything to relive for one more day?",
    bestFor: ["facebook", "instagram", "threads"],
  },
  {
    id: "open-question",
    name: "Open question that invites a story",
    goal: "comments",
    rationale:
      "An open question is not engagement bait, so it keeps full reach while still producing real conversation in the comments.",
    skeleton:
      "What's one {{small, specific, positive}} thing {{timeframe}} that {{effect}}?\nMine: {{your own answer}}. Your turn.",
    example:
      "What's one tiny, ordinary moment with your kid this week that quietly made your whole day? Mine: she narrated our entire walk to a worm. Your turn.",
    bestFor: ["facebook", "instagram", "threads", "linkedin", "x"],
  },
  {
    id: "comment-to-unlock",
    name: "Comment to unlock",
    goal: "leads",
    rationale:
      "Trades reach for a direct-message list. Worth it when the thing you send is genuinely valuable and you want contacts, not applause.",
    skeleton:
      "I made {{the resource}} for {{the specific painful moment}}.\nWant it? Comment {{KEYWORD}} and I'll send it over.",
    example:
      "I made a '10 Phone-Free 5-Minute Games' cheat sheet for the witching hour before dinner. Want it? Comment PLAY and I'll send it over.",
    bestFor: ["instagram", "facebook"],
    caution:
      "Asking for a specific keyword is the exact pattern platforms decline to recommend to non-followers. Reserve it for real lead magnets, not everyday posts.",
  },
];

export function templatesByGoal(goal: Goal): Template[] {
  return TEMPLATES.filter((t) => t.goal === goal);
}

export function getTemplate(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Replace `{{...}}` placeholders, leaving anything unmatched intact. */
export function fillTemplate(
  skeleton: string,
  values: Record<string, string>,
): string {
  return skeleton.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const value = values[key.trim()];
    return value ?? match;
  });
}
