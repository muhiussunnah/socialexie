/**
 * Database types.
 *
 * Hand-maintained to mirror `supabase/migrations`. Regenerate-by-hand is
 * deliberate here: it keeps the client bundle free of a generated 6k-line file
 * and forces schema changes to be reviewed on both sides.
 */

export type MemberRole = "owner" | "admin" | "editor" | "viewer";

export type PlatformIdDb =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin"
  | "pinterest"
  | "threads";

export type AccountStatus = "active" | "expired" | "revoked" | "error";

export type PostStatus =
  | "draft"
  | "pending_approval"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "paused";

export type PostFormatDb =
  | "text"
  | "image"
  | "carousel"
  | "video"
  | "reel"
  | "short"
  | "story";

export type TargetStatus =
  | "pending"
  | "publishing"
  | "published"
  | "failed"
  | "skipped";

export type MediaKind = "image" | "video";
export type PlanTierDb = "free" | "creator" | "studio" | "agency";
export type BillingModeDb = "monthly" | "lifetime";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";
export type AutomationStatus = "draft" | "active" | "paused";
export type AiKind = "image" | "text";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  locale: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  timezone: string;
  brand_voice: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface SocialAccount {
  id: string;
  workspace_id: string;
  platform: PlatformIdDb;
  external_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  /** AES-256-GCM envelopes (see lib/publish/crypto). Never selected client-side. */
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_type: string | null;
  token_expires_at: string | null;
  scopes: string[];
  /** Page tokens, IG user id, LinkedIn author urn, YouTube channel id, etc. */
  provider_metadata: Record<string, unknown>;
  status: AccountStatus;
  last_error: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  workspace_id: string;
  kind: MediaKind;
  storage_path: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  byte_size: number | null;
  alt_text: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  ai_prompt: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ContentCategory {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  recycle: boolean;
  created_at: string;
}

export interface Post {
  id: string;
  workspace_id: string;
  category_id: string | null;
  title: string | null;
  body: string;
  format: PostFormatDb;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  recycle_enabled: boolean;
  recycle_count: number;
  last_recycled_at: string | null;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostTarget {
  id: string;
  post_id: string;
  social_account_id: string;
  platform: PlatformIdDb;
  caption_override: string | null;
  status: TargetStatus;
  external_post_id: string | null;
  permalink: string | null;
  error: string | null;
  attempt_count: number;
  /** When the target becomes eligible again; the cron only claims due rows. */
  next_attempt_at: string | null;
  /** Set when a run flips the row to 'publishing' so a second run can't double-send. */
  locked_at: string | null;
  last_attempt_at: string | null;
  /** Scratch space for multi-step publishes (IG container id, TikTok publish_id). */
  publish_state: Record<string, unknown>;
  published_at: string | null;
}

export interface ScheduleSlot {
  id: string;
  workspace_id: string;
  category_id: string | null;
  day_of_week: number | null;
  time_of_day: string;
  active: boolean;
  created_at: string;
}

export interface Automation {
  id: string;
  workspace_id: string;
  social_account_id: string;
  name: string;
  keywords: string[];
  target_post_id: string | null;
  public_replies: string[];
  optin_message: string;
  payload_message: string;
  payload_url: string | null;
  status: AutomationStatus;
  daily_send_cap: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiGeneration {
  id: string;
  workspace_id: string;
  kind: AiKind;
  provider: string;
  model: string;
  prompt: string;
  params: Record<string, unknown>;
  media_id: string | null;
  output_text: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: number;
  duration_ms: number | null;
  created_by: string | null;
  created_at: string;
}

export interface UsageCounter {
  workspace_id: string;
  period_start: string;
  image_credits: number;
  ai_words: number;
  posts_published: number;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: PlanTierDb;
  billing: BillingModeDb;
  status: SubscriptionStatus;
  current_period_end: string | null;
  provider: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  code: string;
  tier: PlanTierDb;
  seats: number;
  note: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type AiConnectionStatusDb = "not_tested" | "connected" | "error";

export interface AiConnection {
  user_id: string;
  provider: string;
  api_key: string | null;
  enabled: boolean;
  default_text_model: string | null;
  default_image_model: string | null;
  default_video_model: string | null;
  status: AiConnectionStatusDb;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape Supabase expects: every table exposes Row / Insert / Update. */
type Table<Row, Optional extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile, "created_at" | "updated_at" | "locale" | "timezone">;
      workspaces: Table<Workspace, "id" | "created_at" | "updated_at" | "timezone" | "brand_voice">;
      workspace_members: Table<WorkspaceMember, "created_at" | "role">;
      social_accounts: Table<
        SocialAccount,
        | "id"
        | "created_at"
        | "updated_at"
        | "status"
        | "scopes"
        | "access_token_enc"
        | "refresh_token_enc"
        | "token_type"
        | "provider_metadata"
      >;
      media_assets: Table<MediaAsset, "id" | "created_at">;
      content_categories: Table<ContentCategory, "id" | "created_at" | "color" | "recycle">;
      posts: Table<Post, "id" | "created_at" | "updated_at" | "recycle_count" | "status" | "format">;
      post_targets: Table<
        PostTarget,
        | "id"
        | "status"
        | "attempt_count"
        | "next_attempt_at"
        | "locked_at"
        | "last_attempt_at"
        | "publish_state"
      >;
      schedule_slots: Table<ScheduleSlot, "id" | "created_at" | "active">;
      automations: Table<Automation, "id" | "created_at" | "updated_at" | "status" | "daily_send_cap">;
      ai_generations: Table<AiGeneration, "id" | "created_at" | "cost_cents">;
      usage_counters: Table<UsageCounter, "updated_at">;
      subscriptions: Table<Subscription, "id" | "created_at" | "updated_at">;
      licenses: Table<License, "id" | "created_at">;
      ai_connections: Table<
        AiConnection,
        | "created_at"
        | "updated_at"
        | "enabled"
        | "status"
        | "api_key"
        | "default_text_model"
        | "default_image_model"
        | "default_video_model"
        | "last_tested_at"
        | "last_error"
      >;
    };
    Views: Record<never, never>;
    Functions: {
      is_platform_admin: { Args: Record<string, never>; Returns: boolean };
      is_workspace_member: { Args: { target: string }; Returns: boolean };
    };
    Enums: {
      member_role: MemberRole;
      platform_id: PlatformIdDb;
      post_status: PostStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}
