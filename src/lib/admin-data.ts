import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";
import { getPlan } from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  BillingModeDb,
  MediaKind,
  PlanTierDb,
  SubscriptionStatus,
} from "@/lib/supabase/types";

/**
 * Data access for the platform console.
 *
 * Every read here crosses tenant boundaries, so it goes through the service
 * role client and must only be called from a route that has already passed
 * `requireAdmin()`.
 *
 * Without a backend the module answers from a deterministic fixture instead of
 * throwing, which keeps the console reviewable on a fresh clone. Callers show
 * that state to the operator through `isDemoData()`.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type OverviewPeriod = "lifetime" | "30d" | "ytd";

export interface PlatformTotals {
  users: number;
  newUsers: number;
  activeUsers: number;
  workspaces: number;
  channels: number;
  postsPublished: number;
  aiImages: number;
  mrrCents: number;
  lifetimeRevenueCents: number;
}

export interface GrowthPoint {
  label: string;
  value: number;
}

export interface PlanMixRow {
  tier: PlanTierDb;
  label: string;
  color: string;
  monthly: number;
  lifetime: number;
  total: number;
}

export interface TopWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  posts: number;
  aiImages: number;
  lastActive: string | null;
  joined: string;
}

export interface PlatformOverview {
  period: OverviewPeriod;
  totals: PlatformTotals;
  growth: GrowthPoint[];
  planMix: PlanMixRow[];
  topWorkspaces: TopWorkspaceRow[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string | null;
  tier: PlanTierDb;
  billing: BillingModeDb;
  status: SubscriptionStatus;
  workspaces: number;
  posts: number;
  aiImages: number;
  joined: string;
  lastActive: string | null;
}

export interface UserListParams {
  query?: string;
  tier?: PlanTierDb | "all";
  status?: SubscriptionStatus | "all";
  page?: number;
  pageSize?: number;
}

export interface UserListResult {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export type LicenseStatus = "available" | "redeemed" | "revoked";

export interface LicenseRow {
  id: string;
  code: string;
  tier: PlanTierDb;
  seats: number;
  note: string | null;
  redeemedByEmail: string | null;
  redeemedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: LicenseStatus;
}

export interface LicenseListParams {
  status?: LicenseStatus | "all";
  tier?: PlanTierDb | "all";
  page?: number;
  pageSize?: number;
}

export interface LicenseListResult {
  rows: LicenseRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  counts: Record<LicenseStatus, number>;
  /** Cash implied by every redeemed, non-revoked lifetime licence. */
  redeemedRevenueCents: number;
  seatsRedeemed: number;
}

export interface AssetBucket {
  key: string;
  label: string;
  count: number;
  bytes: number;
}

export interface AssetWorkspaceRow {
  id: string;
  name: string;
  assets: number;
  bytes: number;
}

export interface RecentUpload {
  id: string;
  workspace: string;
  kind: MediaKind;
  bytes: number;
  path: string;
  provider: string | null;
  createdAt: string;
}

export interface AssetStats {
  totalAssets: number;
  totalBytes: number;
  imageCount: number;
  videoCount: number;
  aiCount: number;
  byKind: AssetBucket[];
  byProvider: AssetBucket[];
  topWorkspaces: AssetWorkspaceRow[];
  recentUploads: RecentUpload[];
  /** True when the aggregate came from a bounded sample rather than the table. */
  sampled: boolean;
}

export interface AuditEntry {
  id: string;
  createdAt: string;
  actorEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  workspaceName: string | null;
}

export interface AuditListParams {
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditListResult {
  rows: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Every action name present in the log, for the filter dropdown. */
  actions: string[];
}

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

/**
 * Both halves of the config have to be present: the public keys prove a project
 * exists, the service role key is what lets the console read across tenants.
 */
function hasLiveBackend(): boolean {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isDemoData(): boolean {
  return !hasLiveBackend();
}

export const PERIOD_LABEL: Record<OverviewPeriod, string> = {
  lifetime: "Lifetime",
  "30d": "Last 30 days",
  ytd: "This year",
};

export function parsePeriod(value: string | undefined): OverviewPeriod {
  return value === "30d" || value === "ytd" ? value : "lifetime";
}

export function parseTier(value: string | undefined): PlanTierDb | "all" {
  return TIER_ORDER.includes(value as PlanTierDb)
    ? (value as PlanTierDb)
    : "all";
}

export function parseSubscriptionStatus(
  value: string | undefined,
): SubscriptionStatus | "all" {
  return SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus)
    ? (value as SubscriptionStatus)
    : "all";
}

export function parseLicenseStatus(
  value: string | undefined,
): LicenseStatus | "all" {
  return value === "available" || value === "redeemed" || value === "revoked"
    ? value
    : "all";
}

export const TIER_ORDER: readonly PlanTierDb[] = [
  "free",
  "creator",
  "studio",
  "agency",
];

export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
];

const TIER_COLOR: Record<PlanTierDb, string> = {
  free: "#6d7580",
  creator: "#63a4ff",
  studio: "#ffb020",
  agency: "#9b6dff",
};

const TIER_LABEL: Record<PlanTierDb, string> = {
  free: "Free",
  creator: "Creator",
  studio: "Studio",
  agency: "Agency",
};

const BILLABLE: readonly SubscriptionStatus[] = ["trialing", "active", "past_due"];

const DAY = 86_400_000;

function priceCents(tier: PlanTierDb, billing: BillingModeDb): number {
  return getPlan(tier)?.priceCents[billing] ?? 0;
}

function pageMath(total: number, page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { pageCount, current, from: (current - 1) * pageSize };
}

/** Start of the window in epoch ms, or null for all time. */
function periodStart(period: OverviewPeriod, now: number): number | null {
  if (period === "30d") return now - 30 * DAY;
  if (period === "ytd") return Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
  return null;
}

// ---------------------------------------------------------------------------
// Query helpers
//
// PostgREST builders mutate in place, so every query is constructed from
// scratch rather than branched off a shared base.
// ---------------------------------------------------------------------------

/** Minimal surface of a PostgREST builder, used where the row type is irrelevant. */
interface RawQuery extends PromiseLike<{ data: unknown; count: number | null }> {
  select(columns: string, options?: { count?: "exact"; head?: boolean }): RawQuery;
  eq(column: string, value: string): RawQuery;
  gte(column: string, value: string): RawQuery;
  lte(column: string, value: string): RawQuery;
  in(column: string, values: readonly string[]): RawQuery;
  or(filter: string): RawQuery;
  order(column: string, options: { ascending: boolean }): RawQuery;
  range(from: number, to: number): RawQuery;
  limit(count: number): RawQuery;
}

/**
 * Untyped view of the service client, with the row shape declared per query
 * instead of inferred. The hand-maintained table map in `supabase/types` has no
 * PostgREST select metadata, and `audit_log` is not in it at all; naming the
 * columns here keeps this module honest without bending that map around
 * console-only shapes.
 */
function raw(db: ReturnType<typeof supabaseAdmin>) {
  const client = db as unknown as SupabaseClient;
  return (table: string): RawQuery => client.from(table) as unknown as RawQuery;
}

async function fetchRows<T>(query: RawQuery): Promise<T[]> {
  const { data } = await query;
  return Array.isArray(data) ? (data as T[]) : [];
}

async function countRows(
  table: (name: string) => RawQuery,
  name: string,
  refine?: (q: RawQuery) => RawQuery,
): Promise<number> {
  const base = table(name).select("id", { count: "exact", head: true });
  const { count } = await (refine ? refine(base) : base);
  return count ?? 0;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface EmailRow {
  id: string;
  email: string;
}

interface CreatedRow {
  created_at: string;
}

interface SubscriptionRow {
  user_id: string;
  tier: PlanTierDb;
  billing: BillingModeDb;
  status: SubscriptionStatus;
}

interface UsageRow {
  workspace_id: string;
  period_start: string;
  posts_published: number;
  image_credits: number;
  updated_at: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

interface WorkspaceNameRow {
  id: string;
  name: string;
}

interface OwnerRow {
  owner_id: string;
}

interface OwnedWorkspaceRow {
  id: string;
  owner_id: string;
}

interface MemberRow {
  user_id: string;
  workspace_id: string;
}

interface LicenseDbRow {
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

interface MediaRow {
  id: string;
  workspace_id: string;
  kind: MediaKind;
  byte_size: number | null;
  ai_provider: string | null;
  storage_path: string;
  created_at: string;
}

function toUsageMonth(row: UsageRow): UsageMonth {
  return {
    workspaceId: row.workspace_id,
    start: Date.parse(row.period_start),
    posts: row.posts_published,
    images: row.image_credits,
    updatedAt: row.updated_at,
  };
}

function isString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function unique(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter(isString))];
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

interface UsageMonth {
  workspaceId: string;
  start: number;
  posts: number;
  images: number;
  updatedAt: string;
}

export async function getPlatformOverview(
  period: OverviewPeriod = "lifetime",
): Promise<PlatformOverview> {
  if (isDemoData()) return demoOverview(period);

  const db = supabaseAdmin();
  const table = raw(db);
  const now = Date.now();
  const since = periodStart(period, now);
  const sinceIso = since === null ? null : new Date(since).toISOString();

  const [users, newUsers, workspaces, channels, postsPublished, aiImages] =
    await Promise.all([
      countRows(table, "profiles"),
      sinceIso
        ? countRows(table, "profiles", (q) => q.gte("created_at", sinceIso))
        : countRows(table, "profiles"),
      countRows(table, "workspaces"),
      countRows(table, "social_accounts", (q) => q.eq("status", "active")),
      countRows(table, "posts", (q) => {
        const scoped = q.eq("status", "published");
        return sinceIso ? scoped.gte("published_at", sinceIso) : scoped;
      }),
      countRows(table, "ai_generations", (q) => {
        const scoped = q.eq("kind", "image");
        return sinceIso ? scoped.gte("created_at", sinceIso) : scoped;
      }),
    ]);

  const signups = await fetchRows<CreatedRow>(
    table("profiles")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(10_000),
  );

  const subscriptions = await fetchRows<SubscriptionRow>(
    table("subscriptions").select("user_id, tier, billing, status").limit(10_000),
  );

  // usage_counters is the monthly rollup the quota checks already maintain, so
  // platform-wide output questions never have to scan posts or ai_generations.
  const usage = (
    await fetchRows<UsageRow>(
      table("usage_counters")
        .select("workspace_id, period_start, posts_published, image_credits, updated_at")
        .order("period_start", { ascending: false })
        .limit(10_000),
    )
  )
    .map(toUsageMonth)
    .filter((row) => since === null || row.start >= since - 31 * DAY);

  const perWorkspace = foldUsage(usage);
  const busiest = [...perWorkspace.entries()]
    .sort((a, b) => b[1].posts + b[1].images - (a[1].posts + a[1].images))
    .slice(0, 8);

  let topWorkspaces: TopWorkspaceRow[] = [];
  if (busiest.length > 0) {
    const workspaceRows = await fetchRows<WorkspaceRow>(
      table("workspaces")
        .select("id, name, slug, owner_id, created_at")
        .in(
          "id",
          busiest.map(([id]) => id),
        ),
    );
    const ownerIds = unique(workspaceRows.map((w) => w.owner_id));

    let ownerEmail = new Map<string, string>();
    if (ownerIds.length > 0) {
      const owners = await fetchRows<EmailRow>(
        table("profiles").select("id, email").in("id", ownerIds),
      );
      ownerEmail = new Map(owners.map((o) => [o.id, o.email]));
    }

    const byId = new Map(workspaceRows.map((w) => [w.id, w]));
    topWorkspaces = busiest.flatMap(([id, stats]) => {
      const ws = byId.get(id);
      if (!ws) return [];
      return [
        {
          id,
          name: ws.name,
          slug: ws.slug,
          ownerEmail: ownerEmail.get(ws.owner_id) ?? "—",
          posts: stats.posts,
          aiImages: stats.images,
          lastActive: stats.lastActive,
          joined: ws.created_at,
        },
      ];
    });
  }

  // A workspace that recorded output inside the window makes its owner active.
  const producing = [...perWorkspace.entries()]
    .filter(([, s]) => s.posts + s.images > 0)
    .map(([id]) => id);
  let activeUsers = 0;
  if (producing.length > 0) {
    const owners = await fetchRows<OwnerRow>(
      table("workspaces").select("owner_id").in("id", producing),
    );
    activeUsers = new Set(owners.map((w) => w.owner_id)).size;
  }

  let mrrCents = 0;
  let lifetimeRevenueCents = 0;
  for (const sub of subscriptions) {
    if (!BILLABLE.includes(sub.status)) continue;
    if (sub.billing === "monthly") mrrCents += priceCents(sub.tier, "monthly");
    else lifetimeRevenueCents += priceCents(sub.tier, "lifetime");
  }

  return {
    period,
    totals: {
      users,
      newUsers,
      activeUsers,
      workspaces,
      channels,
      postsPublished,
      aiImages,
      mrrCents,
      lifetimeRevenueCents,
    },
    growth: buildGrowth(
      signups.map((p) => Date.parse(p.created_at)),
      period,
      now,
    ),
    planMix: buildPlanMix(subscriptions),
    topWorkspaces,
  };
}

interface WorkspaceUsage {
  posts: number;
  images: number;
  lastActive: string | null;
}

function foldUsage(rows: readonly UsageMonth[]): Map<string, WorkspaceUsage> {
  const out = new Map<string, WorkspaceUsage>();
  for (const row of rows) {
    const entry = out.get(row.workspaceId) ?? {
      posts: 0,
      images: 0,
      lastActive: null,
    };
    entry.posts += row.posts;
    entry.images += row.images;
    if (!entry.lastActive || row.updatedAt > entry.lastActive) {
      entry.lastActive = row.updatedAt;
    }
    out.set(row.workspaceId, entry);
  }
  return out;
}

function buildPlanMix(
  subscriptions: readonly {
    tier: PlanTierDb;
    billing: BillingModeDb;
    status: SubscriptionStatus;
  }[],
): PlanMixRow[] {
  const rows = new Map<PlanTierDb, PlanMixRow>(
    TIER_ORDER.map((tier) => [
      tier,
      {
        tier,
        label: TIER_LABEL[tier],
        color: TIER_COLOR[tier],
        monthly: 0,
        lifetime: 0,
        total: 0,
      },
    ]),
  );

  for (const sub of subscriptions) {
    if (!BILLABLE.includes(sub.status)) continue;
    const row = rows.get(sub.tier);
    if (!row) continue;
    if (sub.billing === "lifetime") row.lifetime += 1;
    else row.monthly += 1;
    row.total += 1;
  }

  return TIER_ORDER.flatMap((tier) => {
    const row = rows.get(tier);
    return row ? [row] : [];
  });
}

/** Cumulative signups bucketed across the window, oldest first. */
function buildGrowth(
  createdAt: readonly number[],
  period: OverviewPeriod,
  now: number,
): GrowthPoint[] {
  const sorted = [...createdAt].sort((a, b) => a - b);
  const start =
    periodStart(period, now) ?? (sorted.length > 0 ? sorted[0] : now - 365 * DAY);
  const buckets = period === "30d" ? 15 : 12;
  const width = Math.max(1, (now - start) / buckets);

  const points: GrowthPoint[] = [];
  let cursor = 0;
  let running = 0;
  for (let i = 0; i < buckets; i += 1) {
    const edge = start + width * (i + 1);
    while (cursor < sorted.length && sorted[cursor] <= edge) {
      running += 1;
      cursor += 1;
    }
    points.push({ label: bucketLabel(edge, period), value: running });
  }
  return points;
}

function bucketLabel(at: number, period: OverviewPeriod): string {
  const options: Intl.DateTimeFormatOptions =
    period === "30d"
      ? { month: "short", day: "numeric" }
      : period === "ytd"
        ? { month: "short" }
        : { month: "short", year: "2-digit" };
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(
    new Date(at),
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(
  params: UserListParams = {},
): Promise<UserListResult> {
  const pageSize = params.pageSize ?? 25;
  const query = params.query?.trim() ?? "";
  const tier = params.tier ?? "all";
  const status = params.status ?? "all";
  const page = params.page ?? 1;

  if (isDemoData()) {
    return demoUsers({ query, tier, status, page, pageSize });
  }

  const db = supabaseAdmin();
  const table = raw(db);

  // The hand-maintained table map carries no relationship metadata, so a plan
  // or status filter resolves to an id lookup rather than an embedded filter.
  let restrictTo: string[] | null = null;
  if (tier !== "all" || status !== "all") {
    let subs = table("subscriptions").select("user_id").limit(10_000);
    if (tier !== "all") subs = subs.eq("tier", tier);
    if (status !== "all") subs = subs.eq("status", status);
    const matches = await fetchRows<{ user_id: string }>(subs);
    restrictTo = unique(matches.map((r) => r.user_id));
    if (restrictTo.length === 0) {
      return { rows: [], total: 0, page: 1, pageSize, pageCount: 1 };
    }
  }

  const escaped = query.replace(/[%,()]/g, "");
  const build = (columns: string, head: boolean) => {
    let q = table("profiles").select(
      columns,
      head ? { count: "exact", head: true } : { count: "exact" },
    );
    if (escaped) q = q.or(`email.ilike.%${escaped}%,full_name.ilike.%${escaped}%`);
    if (restrictTo) q = q.in("id", restrictTo);
    return q;
  };

  const { count } = await build("id", true);
  const total = count ?? 0;
  const { pageCount, current, from } = pageMath(total, page, pageSize);

  const profiles = await fetchRows<ProfileRow>(
    build("id, email, full_name, created_at", false)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1),
  );

  if (profiles.length === 0) {
    return { rows: [], total, page: current, pageSize, pageCount };
  }

  const ids = profiles.map((p) => p.id);
  const [subs, owned, members] = await Promise.all([
    fetchRows<SubscriptionRow>(
      table("subscriptions")
        .select("user_id, tier, billing, status")
        .in("user_id", ids),
    ),
    fetchRows<OwnedWorkspaceRow>(
      table("workspaces").select("id, owner_id").in("owner_id", ids),
    ),
    fetchRows<MemberRow>(
      table("workspace_members").select("user_id, workspace_id").in("user_id", ids),
    ),
  ]);

  const subByUser = new Map(subs.map((s) => [s.user_id, s] as const));

  const workspacesByUser = new Map<string, Set<string>>();
  const add = (userId: string, workspaceId: string) => {
    const set = workspacesByUser.get(userId) ?? new Set<string>();
    set.add(workspaceId);
    workspacesByUser.set(userId, set);
  };
  for (const row of members) add(row.user_id, row.workspace_id);
  for (const row of owned) add(row.owner_id, row.id);

  const allWorkspaceIds = [
    ...new Set([...workspacesByUser.values()].flatMap((set) => [...set])),
  ];

  let usageByWorkspace = new Map<string, WorkspaceUsage>();
  if (allWorkspaceIds.length > 0) {
    const usage = await fetchRows<UsageRow>(
      table("usage_counters")
        .select("workspace_id, period_start, posts_published, image_credits, updated_at")
        .in("workspace_id", allWorkspaceIds),
    );
    usageByWorkspace = foldUsage(usage.map(toUsageMonth));
  }

  const rows: AdminUserRow[] = profiles.map((profile) => {
    const owned = workspacesByUser.get(profile.id) ?? new Set<string>();
    let posts = 0;
    let images = 0;
    let lastActive: string | null = null;
    for (const id of owned) {
      const entry = usageByWorkspace.get(id);
      if (!entry) continue;
      posts += entry.posts;
      images += entry.images;
      if (entry.lastActive && (!lastActive || entry.lastActive > lastActive)) {
        lastActive = entry.lastActive;
      }
    }
    const sub = subByUser.get(profile.id);
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      tier: sub?.tier ?? "free",
      billing: sub?.billing ?? "monthly",
      status: sub?.status ?? "active",
      workspaces: owned.size,
      posts,
      aiImages: images,
      joined: profile.created_at,
      lastActive,
    };
  });

  return { rows, total, page: current, pageSize, pageCount };
}

// ---------------------------------------------------------------------------
// Licenses
// ---------------------------------------------------------------------------

export async function listLicenses(
  params: LicenseListParams = {},
): Promise<LicenseListResult> {
  const pageSize = params.pageSize ?? 25;
  const status = params.status ?? "all";
  const tier = params.tier ?? "all";
  const page = params.page ?? 1;

  if (isDemoData()) {
    return finishLicenses(demoDb().licenses, { status, tier, page, pageSize });
  }

  const db = supabaseAdmin();
  const table = raw(db);

  const records = await fetchRows<LicenseDbRow>(
    table("licenses")
      .select(
        "id, code, tier, seats, note, redeemed_by, redeemed_at, revoked_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(5_000),
  );

  const redeemerIds = unique(records.map((r) => r.redeemed_by));
  let emailById = new Map<string, string>();
  if (redeemerIds.length > 0) {
    const redeemers = await fetchRows<EmailRow>(
      table("profiles").select("id, email").in("id", redeemerIds),
    );
    emailById = new Map(redeemers.map((p) => [p.id, p.email]));
  }

  const mapped: LicenseRow[] = records.map((row) => ({
    id: row.id,
    code: row.code,
    tier: row.tier,
    seats: row.seats,
    note: row.note,
    redeemedByEmail: row.redeemed_by
      ? (emailById.get(row.redeemed_by) ?? null)
      : null,
    redeemedAt: row.redeemed_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    status: row.revoked_at ? "revoked" : row.redeemed_by ? "redeemed" : "available",
  }));

  return finishLicenses(mapped, { status, tier, page, pageSize });
}

function finishLicenses(
  all: readonly LicenseRow[],
  opts: {
    status: LicenseStatus | "all";
    tier: PlanTierDb | "all";
    page: number;
    pageSize: number;
  },
): LicenseListResult {
  const counts: Record<LicenseStatus, number> = {
    available: 0,
    redeemed: 0,
    revoked: 0,
  };
  let redeemedRevenueCents = 0;
  let seatsRedeemed = 0;

  for (const row of all) {
    counts[row.status] += 1;
    if (row.status === "redeemed") {
      redeemedRevenueCents += priceCents(row.tier, "lifetime");
      seatsRedeemed += row.seats;
    }
  }

  const filtered = all.filter(
    (row) =>
      (opts.status === "all" || row.status === opts.status) &&
      (opts.tier === "all" || row.tier === opts.tier),
  );

  const { pageCount, current, from } = pageMath(
    filtered.length,
    opts.page,
    opts.pageSize,
  );

  return {
    rows: filtered.slice(from, from + opts.pageSize),
    total: filtered.length,
    page: current,
    pageSize: opts.pageSize,
    pageCount,
    counts,
    redeemedRevenueCents,
    seatsRedeemed,
  };
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

/** Rows the storage aggregate will scan before it reports itself as a sample. */
const ASSET_SCAN_LIMIT = 5_000;

export async function getAssetStats(): Promise<AssetStats> {
  if (isDemoData()) return demoDb().assets;

  const db = supabaseAdmin();
  const table = raw(db);
  const total = await countRows(table, "media_assets");

  const records = await fetchRows<MediaRow>(
    table("media_assets")
      .select("id, workspace_id, kind, byte_size, ai_provider, storage_path, created_at")
      .order("created_at", { ascending: false })
      .limit(ASSET_SCAN_LIMIT),
  );

  const workspaceIds = unique(records.map((r) => r.workspace_id));
  let nameById = new Map<string, string>();
  if (workspaceIds.length > 0) {
    const named = await fetchRows<WorkspaceNameRow>(
      table("workspaces").select("id, name").in("id", workspaceIds),
    );
    nameById = new Map(named.map((w) => [w.id, w.name]));
  }

  return aggregateAssets(
    records.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      workspace: nameById.get(r.workspace_id) ?? "Unknown workspace",
      kind: r.kind,
      bytes: r.byte_size ?? 0,
      provider: r.ai_provider,
      path: r.storage_path,
      createdAt: r.created_at,
    })),
    total || records.length,
    total > records.length,
  );
}

interface AssetInput {
  id: string;
  workspaceId: string;
  workspace: string;
  kind: MediaKind;
  bytes: number;
  provider: string | null;
  path: string;
  createdAt: string;
}

function aggregateAssets(
  rows: readonly AssetInput[],
  totalAssets: number,
  sampled: boolean,
): AssetStats {
  const kinds = new Map<MediaKind, AssetBucket>();
  const providers = new Map<string, AssetBucket>();
  const perWorkspace = new Map<string, AssetWorkspaceRow>();
  let totalBytes = 0;
  let aiCount = 0;

  for (const row of rows) {
    totalBytes += row.bytes;

    const kind = kinds.get(row.kind) ?? {
      key: row.kind,
      label: row.kind === "image" ? "Images" : "Video",
      count: 0,
      bytes: 0,
    };
    kind.count += 1;
    kind.bytes += row.bytes;
    kinds.set(row.kind, kind);

    if (row.provider) {
      aiCount += 1;
      const provider = providers.get(row.provider) ?? {
        key: row.provider,
        label: row.provider,
        count: 0,
        bytes: 0,
      };
      provider.count += 1;
      provider.bytes += row.bytes;
      providers.set(row.provider, provider);
    }

    const ws = perWorkspace.get(row.workspaceId) ?? {
      id: row.workspaceId,
      name: row.workspace,
      assets: 0,
      bytes: 0,
    };
    ws.assets += 1;
    ws.bytes += row.bytes;
    perWorkspace.set(row.workspaceId, ws);
  }

  return {
    totalAssets,
    totalBytes,
    imageCount: kinds.get("image")?.count ?? 0,
    videoCount: kinds.get("video")?.count ?? 0,
    aiCount,
    byKind: [...kinds.values()].sort((a, b) => b.bytes - a.bytes),
    byProvider: [...providers.values()].sort((a, b) => b.count - a.count),
    topWorkspaces: [...perWorkspace.values()]
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8),
    recentUploads: rows.slice(0, 10).map((r) => ({
      id: r.id,
      workspace: r.workspace,
      kind: r.kind,
      bytes: r.bytes,
      path: r.path,
      provider: r.provider,
      createdAt: r.createdAt,
    })),
    sampled,
  };
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

interface AuditRecord {
  id: number | string;
  workspace_id: string | null;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function listAuditEntries(
  params: AuditListParams = {},
): Promise<AuditListResult> {
  const pageSize = params.pageSize ?? 40;
  const page = params.page ?? 1;
  if (isDemoData()) return demoAudit({ ...params, page, pageSize });

  const db = supabaseAdmin();
  const table = raw(db);

  const build = (head: boolean) => {
    let q = table("audit_log").select(
      "id, workspace_id, actor_id, action, entity, entity_id, metadata, created_at",
      head ? { count: "exact", head: true } : { count: "exact" },
    );
    if (params.action && params.action !== "all") q = q.eq("action", params.action);
    if (params.from) q = q.gte("created_at", `${params.from}T00:00:00.000Z`);
    if (params.to) q = q.lte("created_at", `${params.to}T23:59:59.999Z`);
    return q;
  };

  const { count } = await build(true);
  const total = count ?? 0;
  const { pageCount, current, from } = pageMath(total, page, pageSize);

  const records = await fetchRows<AuditRecord>(
    build(false)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1),
  );

  const actorIds = unique(records.map((r) => r.actor_id));
  const workspaceIds = unique(records.map((r) => r.workspace_id));

  let emailById = new Map<string, string>();
  if (actorIds.length > 0) {
    const actors = await fetchRows<EmailRow>(
      table("profiles").select("id, email").in("id", actorIds),
    );
    emailById = new Map(actors.map((a) => [a.id, a.email]));
  }

  let nameById = new Map<string, string>();
  if (workspaceIds.length > 0) {
    const named = await fetchRows<WorkspaceNameRow>(
      table("workspaces").select("id, name").in("id", workspaceIds),
    );
    nameById = new Map(named.map((w) => [w.id, w.name]));
  }

  const actionRows = await fetchRows<{ action: string }>(
    table("audit_log").select("action").limit(2_000),
  );
  const actions = [...new Set(actionRows.map((r) => r.action))].sort();

  return {
    rows: records.map((row) => ({
      id: String(row.id),
      createdAt: row.created_at,
      actorEmail: row.actor_id ? (emailById.get(row.actor_id) ?? null) : null,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      metadata: row.metadata ?? {},
      workspaceName: row.workspace_id ? (nameById.get(row.workspace_id) ?? null) : null,
    })),
    total,
    page: current,
    pageSize,
    pageCount,
    actions,
  };
}

// ---------------------------------------------------------------------------
// Demo fixture
//
// Built once from a fixed seed, so two renders of the same page always agree
// and nothing here reads the wall clock.
// ---------------------------------------------------------------------------

const DEMO_NOW = Date.UTC(2026, 6, 29, 9, 0, 0);
const DEMO_SEED = 0x5e13a1;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const FIRST_NAMES = [
  "Maya", "Tobias", "Ingrid", "Rafael", "Nadia", "Oskar", "Priya", "Lucas",
  "Amara", "Jonas", "Selin", "Mattias", "Chiara", "Dmitri", "Farida", "Noah",
  "Elena", "Kwame", "Sofia", "Henrik", "Mira", "Andres", "Yuki", "Petra",
  "Omar", "Linnea", "Tomas", "Aisha", "Viktor", "Rosa",
];

const LAST_NAMES = [
  "Lindqvist", "Ferreira", "Novak", "Osei", "Bergman", "Ahmadi", "Costa",
  "Duval", "Haugen", "Iqbal", "Jensen", "Kowalski", "Moreau", "Nyberg",
  "Okafor", "Petrov", "Rossi", "Sandoval", "Takahashi", "Ustinov",
];

const BRAND_WORDS = [
  "Northwind", "Saltbox", "Copper Lane", "Field Notes", "Bright Hour",
  "Longform", "Quiet Kitchen", "Paper Trail", "Third Coast", "Slow Sunday",
  "Ember & Oak", "Approved By Families", "Two Birds", "Studio Vantage",
  "Harbour Line", "Wildcraft", "Little Atlas", "Runway North", "Foldout",
  "Tallgrass", "Nine Yards", "Signal Fire", "Blue Hour", "Common Ground",
];

const MAIL_HOSTS = ["gmail.com", "outlook.com", "proton.me", "fastmail.com"];

const AI_PROVIDERS = ["google", "openai", "openrouter"];

const AUDIT_ACTIONS = [
  "user.signed_in",
  "user.plan_changed",
  "workspace.created",
  "workspace.deleted",
  "channel.connected",
  "channel.token_refreshed",
  "post.published",
  "post.failed",
  "license.redeemed",
  "license.revoked",
  "asset.uploaded",
  "automation.activated",
];

const SUFFIXES = ["Reels", "Studio", "Client", "Lab"];

const LICENSE_NOTES: (string | null)[] = [
  null,
  "Launch batch 3",
  "Founding member",
  "Podcast partner",
  "Support goodwill",
  "Black Friday",
];

interface DemoWorkspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: number;
  usage: { start: number; posts: number; images: number }[];
}

interface DemoUser {
  id: string;
  email: string;
  fullName: string;
  tier: PlanTierDb;
  billing: BillingModeDb;
  status: SubscriptionStatus;
  joinedAt: number;
  workspaceIds: string[];
}

interface DemoDb {
  users: DemoUser[];
  workspaces: DemoWorkspace[];
  workspaceById: Map<string, DemoWorkspace>;
  userById: Map<string, DemoUser>;
  licenses: LicenseRow[];
  audit: AuditEntry[];
  assets: AssetStats;
  channels: number;
}

let fixture: DemoDb | null = null;

function demoDb(): DemoDb {
  if (fixture) return fixture;

  const random = rng(DEMO_SEED);
  const pick = <T,>(list: readonly T[]): T =>
    list[Math.floor(random() * list.length)];
  const between = (min: number, max: number) =>
    Math.floor(min + random() * (max - min + 1));

  const users: DemoUser[] = [];
  const workspaces: DemoWorkspace[] = [];

  const TIER_WEIGHTS: { tier: PlanTierDb; weight: number }[] = [
    { tier: "free", weight: 52 },
    { tier: "creator", weight: 26 },
    { tier: "studio", weight: 16 },
    { tier: "agency", weight: 6 },
  ];

  for (let i = 0; i < 164; i += 1) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);

    const roll = random() * 100;
    let acc = 0;
    let tier: PlanTierDb = "free";
    for (const entry of TIER_WEIGHTS) {
      acc += entry.weight;
      if (roll <= acc) {
        tier = entry.tier;
        break;
      }
    }

    const billing: BillingModeDb =
      tier !== "free" && random() < 0.38 ? "lifetime" : "monthly";

    const statusRoll = random();
    const status: SubscriptionStatus =
      tier === "free"
        ? "active"
        : statusRoll > 0.94
          ? "past_due"
          : statusRoll > 0.88
            ? "canceled"
            : statusRoll > 0.83
              ? "trialing"
              : "active";

    // Signups accelerate over time, so bias joined dates to the recent end.
    const joinedAt = DEMO_NOW - Math.floor(Math.pow(random(), 1.7) * 540) * DAY;
    const userId = `usr_${(i + 1).toString().padStart(4, "0")}`;

    const workspaceCount =
      tier === "agency"
        ? between(3, 6)
        : tier === "studio"
          ? between(2, 4)
          : tier === "creator"
            ? between(1, 2)
            : 1;

    const workspaceIds: string[] = [];
    for (let w = 0; w < workspaceCount; w += 1) {
      const name = w === 0 ? pick(BRAND_WORDS) : `${pick(BRAND_WORDS)} ${SUFFIXES[w % 4]}`;
      const id = `wsp_${workspaces.length + 1}`;
      const createdAt = joinedAt + between(0, 12) * DAY;
      const intensity =
        tier === "agency" ? 3.4 : tier === "studio" ? 2.1 : tier === "creator" ? 1.2 : 0.3;

      const months = Math.max(
        1,
        Math.min(18, Math.ceil((DEMO_NOW - createdAt) / (30 * DAY))),
      );
      // Roughly a third of brands go quiet, which is what separates "signed up"
      // from "active" once the console filters on a window.
      const quietFor =
        random() < 0.32 ? Math.min(between(1, 8), months - 1) : 0;

      const usage: DemoWorkspace["usage"] = [];
      for (let m = months - 1; m >= quietFor; m -= 1) {
        const ramp = 0.55 + 0.45 * ((months - m) / months);
        usage.push({
          start: DEMO_NOW - m * 30 * DAY,
          posts: Math.round(between(4, 46) * intensity * ramp),
          images: Math.round(between(2, 70) * intensity * ramp),
        });
      }

      workspaces.push({
        id,
        name,
        slug: slugify(name, id),
        ownerId: userId,
        createdAt,
        usage,
      });
      workspaceIds.push(id);
    }

    users.push({
      id: userId,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${between(1, 89)}@${pick(MAIL_HOSTS)}`,
      fullName: `${first} ${last}`,
      tier,
      billing,
      status,
      joinedAt,
      workspaceIds,
    });
  }

  const userById = new Map(users.map((u) => [u.id, u]));
  const workspaceById = new Map(workspaces.map((w) => [w.id, w]));
  const lifetimeBuyers = users.filter((u) => u.billing === "lifetime");

  const licenses: LicenseRow[] = [];
  for (let i = 0; i < 72; i += 1) {
    const tier = pick<PlanTierDb>(["creator", "studio", "studio", "agency"]);
    const createdAt = DEMO_NOW - between(10, 500) * DAY;
    const roll = random();
    const buyer =
      lifetimeBuyers.length > 0
        ? lifetimeBuyers[Math.floor(random() * lifetimeBuyers.length)]
        : null;
    const redeemed = roll < 0.58 && buyer !== null;
    const revoked = !redeemed && roll > 0.92;

    licenses.push({
      id: `lic_${i + 1}`,
      code: demoCode(random),
      tier,
      seats: tier === "agency" ? between(5, 25) : tier === "studio" ? between(2, 6) : 1,
      note: pick(LICENSE_NOTES),
      redeemedByEmail: redeemed && buyer ? buyer.email : null,
      redeemedAt: redeemed
        ? new Date(createdAt + between(1, 60) * DAY).toISOString()
        : null,
      revokedAt: revoked
        ? new Date(createdAt + between(20, 120) * DAY).toISOString()
        : null,
      createdAt: new Date(createdAt).toISOString(),
      status: revoked ? "revoked" : redeemed ? "redeemed" : "available",
    });
  }
  licenses.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const audit: AuditEntry[] = [];
  for (let i = 0; i < 220; i += 1) {
    const actor = users[Math.floor(random() * users.length)];
    const workspace = workspaces[Math.floor(random() * workspaces.length)];
    const action = pick(AUDIT_ACTIONS);
    const entity = action.split(".")[0];
    const at = DEMO_NOW - Math.floor(Math.pow(random(), 1.4) * 44 * DAY);

    audit.push({
      id: `aud_${i + 1}`,
      createdAt: new Date(at).toISOString(),
      actorEmail: action.startsWith("license.") ? "itsinjamul@gmail.com" : actor.email,
      action,
      entity,
      entityId: `${entity}_${between(1_000, 9_999)}`,
      metadata: auditMetadata(action, workspace.name, between(1, 9)),
      workspaceName: action.startsWith("user.") ? null : workspace.name,
    });
  }
  audit.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // Storage concentrates in the workspaces that publish most, so sample the
  // busiest end of the list heavily rather than spreading uploads evenly.
  const byOutput = [...workspaces].sort(
    (a, b) => workspaceOutput(b) - workspaceOutput(a),
  );

  const assetRows: AssetInput[] = [];
  for (let i = 0; i < 900; i += 1) {
    const workspace = byOutput[Math.floor(Math.pow(random(), 2.2) * byOutput.length)];
    const isVideo = random() < 0.22;
    const provider = !isVideo && random() < 0.62 ? pick(AI_PROVIDERS) : null;
    const at = DEMO_NOW - Math.floor(Math.pow(random(), 1.5) * 300 * DAY);

    assetRows.push({
      id: `ast_${i + 1}`,
      workspaceId: workspace.id,
      workspace: workspace.name,
      kind: isVideo ? "video" : "image",
      bytes: isVideo ? between(8_000_000, 240_000_000) : between(180_000, 5_400_000),
      provider,
      path: `${workspace.slug}/${isVideo ? "video" : "image"}/${demoCode(random).slice(4).toLowerCase()}.${isVideo ? "mp4" : "webp"}`,
      createdAt: new Date(at).toISOString(),
    });
  }
  assetRows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  fixture = {
    users,
    workspaces,
    workspaceById,
    userById,
    licenses,
    audit,
    assets: aggregateAssets(assetRows, assetRows.length, false),
    channels: workspaces.reduce((n, w) => n + 2 + (w.usage.length % 5), 0),
  };
  return fixture;
}

function workspaceOutput(workspace: DemoWorkspace): number {
  return workspace.usage.reduce((n, month) => n + month.posts + month.images, 0);
}

function slugify(name: string, fallback: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base.length >= 3 ? base : fallback;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function demoCode(random: () => number): string {
  const block = () =>
    Array.from(
      { length: 4 },
      () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)],
    ).join("");
  return `SLX-${block()}-${block()}-${block()}`;
}

function auditMetadata(
  action: string,
  workspace: string,
  n: number,
): Record<string, unknown> {
  switch (action) {
    case "user.plan_changed":
      return { from: "creator", to: "studio", billing: "monthly" };
    case "post.published":
      return { workspace, targets: n, platform: "instagram" };
    case "post.failed":
      return { workspace, reason: "token_expired", attempt: n };
    case "channel.connected":
      return { workspace, platform: "tiktok", scopes: n };
    case "license.redeemed":
      return { seats: n, tier: "studio" };
    case "asset.uploaded":
      return { workspace, bytes: n * 1_240_000, kind: "image" };
    default:
      return { workspace };
  }
}

// ---------------------------------------------------------------------------
// Demo readers
// ---------------------------------------------------------------------------

function demoOverview(period: OverviewPeriod): PlatformOverview {
  const db = demoDb();
  const since = periodStart(period, DEMO_NOW);

  const usage: UsageMonth[] = [];
  for (const workspace of db.workspaces) {
    for (const month of workspace.usage) {
      if (since !== null && month.start < since) continue;
      usage.push({
        workspaceId: workspace.id,
        start: month.start,
        posts: month.posts,
        images: month.images,
        updatedAt: new Date(month.start).toISOString(),
      });
    }
  }

  const perWorkspace = foldUsage(usage);
  const postsPublished = usage.reduce((n, m) => n + m.posts, 0);
  const aiImages = usage.reduce((n, m) => n + m.images, 0);

  const activeOwners = new Set(
    [...perWorkspace.keys()].flatMap((id) => {
      const owner = db.workspaceById.get(id)?.ownerId;
      return owner ? [owner] : [];
    }),
  );

  const topWorkspaces: TopWorkspaceRow[] = [...perWorkspace.entries()]
    .sort((a, b) => b[1].posts + b[1].images - (a[1].posts + a[1].images))
    .slice(0, 8)
    .flatMap(([id, stats]) => {
      const workspace = db.workspaceById.get(id);
      if (!workspace) return [];
      return [
        {
          id,
          name: workspace.name,
          slug: workspace.slug,
          ownerEmail: db.userById.get(workspace.ownerId)?.email ?? "—",
          posts: stats.posts,
          aiImages: stats.images,
          lastActive: stats.lastActive,
          joined: new Date(workspace.createdAt).toISOString(),
        },
      ];
    });

  let mrrCents = 0;
  let lifetimeRevenueCents = 0;
  for (const user of db.users) {
    if (!BILLABLE.includes(user.status)) continue;
    if (user.billing === "monthly") mrrCents += priceCents(user.tier, "monthly");
    else lifetimeRevenueCents += priceCents(user.tier, "lifetime");
  }

  return {
    period,
    totals: {
      users: db.users.length,
      newUsers: db.users.filter((u) => since === null || u.joinedAt >= since).length,
      activeUsers: activeOwners.size,
      workspaces: db.workspaces.length,
      channels: db.channels,
      postsPublished,
      aiImages,
      mrrCents,
      lifetimeRevenueCents,
    },
    growth: buildGrowth(
      db.users.map((u) => u.joinedAt),
      period,
      DEMO_NOW,
    ),
    planMix: buildPlanMix(db.users),
    topWorkspaces,
  };
}

function demoUsers(params: Required<UserListParams>): UserListResult {
  const db = demoDb();
  const needle = params.query.toLowerCase();

  const filtered = db.users
    .filter((user) => {
      if (params.tier !== "all" && user.tier !== params.tier) return false;
      if (params.status !== "all" && user.status !== params.status) return false;
      if (!needle) return true;
      return (
        user.email.toLowerCase().includes(needle) ||
        user.fullName.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => b.joinedAt - a.joinedAt);

  const { pageCount, current, from } = pageMath(
    filtered.length,
    params.page,
    params.pageSize,
  );

  const rows: AdminUserRow[] = filtered
    .slice(from, from + params.pageSize)
    .map((user) => {
      let posts = 0;
      let images = 0;
      let lastActive = 0;
      for (const id of user.workspaceIds) {
        const workspace = db.workspaceById.get(id);
        if (!workspace) continue;
        for (const month of workspace.usage) {
          posts += month.posts;
          images += month.images;
          lastActive = Math.max(lastActive, month.start);
        }
      }
      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tier: user.tier,
        billing: user.billing,
        status: user.status,
        workspaces: user.workspaceIds.length,
        posts,
        aiImages: images,
        joined: new Date(user.joinedAt).toISOString(),
        lastActive: lastActive > 0 ? new Date(lastActive).toISOString() : null,
      };
    });

  return {
    rows,
    total: filtered.length,
    page: current,
    pageSize: params.pageSize,
    pageCount,
  };
}

function demoAudit(
  params: AuditListParams & { page: number; pageSize: number },
): AuditListResult {
  const db = demoDb();

  const filtered = db.audit.filter((entry) => {
    if (params.action && params.action !== "all" && entry.action !== params.action) {
      return false;
    }
    if (params.from && entry.createdAt < `${params.from}T00:00:00.000Z`) return false;
    if (params.to && entry.createdAt > `${params.to}T23:59:59.999Z`) return false;
    return true;
  });

  const { pageCount, current, from } = pageMath(
    filtered.length,
    params.page,
    params.pageSize,
  );

  return {
    rows: filtered.slice(from, from + params.pageSize),
    total: filtered.length,
    page: current,
    pageSize: params.pageSize,
    pageCount,
    actions: [...AUDIT_ACTIONS].sort(),
  };
}
