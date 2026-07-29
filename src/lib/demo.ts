import type { PlatformId } from "@/lib/platforms";

/**
 * Sample data used when Supabase is not configured.
 *
 * Everything here is clearly fictional and every screen that reads it shows a
 * "demo data" banner, so nobody mistakes these numbers for their own.
 */

export interface DemoChannel {
  id: string;
  platform: PlatformId;
  handle: string;
  followers: number;
  growth7d: number;
  status: "active" | "expired";
}

export interface DemoPost {
  id: string;
  time: string;
  day: string;
  title: string;
  channels: PlatformId[];
  status: "scheduled" | "published" | "draft" | "failed" | "recycling";
  category: string;
}

export const demoWorkspace = {
  name: "Approved By Families",
  slug: "approved-by-families",
  timezone: "Europe/Stockholm",
  plan: "Studio",
};

export const demoChannels: DemoChannel[] = [
  { id: "c1", platform: "instagram", handle: "@approvedbyfamilies", followers: 12_480, growth7d: 4.2, status: "active" },
  { id: "c2", platform: "facebook", handle: "Approved By Families", followers: 8_930, growth7d: 2.1, status: "active" },
  { id: "c3", platform: "tiktok", handle: "@approvedbyfamilies", followers: 24_110, growth7d: 9.6, status: "active" },
  { id: "c4", platform: "youtube", handle: "@approvedbyfamilies", followers: 5_240, growth7d: 6.4, status: "active" },
  { id: "c5", platform: "threads", handle: "@approvedbyfamilies", followers: 3_180, growth7d: 11.2, status: "active" },
  { id: "c6", platform: "pinterest", handle: "Approved By Families", followers: 1_960, growth7d: 1.4, status: "expired" },
];

export const demoPosts: DemoPost[] = [
  { id: "p1", day: "Today", time: "09:00", title: "7 things nobody tells you about a 3-year-old", channels: ["instagram", "facebook", "threads"], status: "published", category: "Carousels" },
  { id: "p2", day: "Today", time: "12:30", title: "Phone-free dinner challenge — day 4", channels: ["tiktok", "youtube", "instagram"], status: "scheduled", category: "Reels" },
  { id: "p3", day: "Today", time: "15:15", title: "Save this: 5 things to say instead of 'good job'", channels: ["pinterest", "linkedin", "x"], status: "recycling", category: "Save-this lists" },
  { id: "p4", day: "Today", time: "19:00", title: "Sunset park carousel · 4 frames", channels: ["instagram", "facebook"], status: "scheduled", category: "Carousels" },
  { id: "p5", day: "Tomorrow", time: "08:30", title: "The 10-minute rule that ended our bedtime war", channels: ["facebook", "threads"], status: "scheduled", category: "Stories" },
  { id: "p6", day: "Tomorrow", time: "13:00", title: "POV: you put the phone down first", channels: ["tiktok", "instagram", "youtube"], status: "scheduled", category: "Reels" },
  { id: "p7", day: "Tomorrow", time: "18:45", title: "Would you rather: 5am riser or no-nap toddler?", channels: ["facebook", "x"], status: "draft", category: "Engagement" },
];

/** Seven days of reach, oldest first. Used by the sparkline on the overview. */
export const demoReachSeries = [
  8_420, 11_260, 9_870, 14_310, 21_540, 18_920, 26_180,
];

export const demoMetrics = {
  scheduled: 1_284,
  publishedThisWeek: 46,
  reach30d: 1_248_000,
  shares30d: 18_420,
  imageCredits: { used: 512, limit: 2_500 },
  aiWords: { used: 184_000, limit: 750_000 },
};

export const demoCategories = [
  { name: "Reels", count: 214, color: "#FFB020", recycle: true },
  { name: "Carousels", count: 168, color: "#23C8AE", recycle: true },
  { name: "Save-this lists", count: 96, color: "#63A4FF", recycle: true },
  { name: "Engagement", count: 74, color: "#9B6DFF", recycle: false },
  { name: "Stories", count: 52, color: "#FF6B61", recycle: false },
];
