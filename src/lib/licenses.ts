import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getPlan, type PlanTier } from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { PlanTierDb } from "@/lib/supabase/types";

export type RedeemResult =
  | { ok: true; tier: PlanTierDb; plan: string }
  | { ok: false; error: string };

export type GenerateResult =
  | { ok: true; codes: string[] }
  | { ok: false; error: string };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** A subscription in one of these states grants its tier's entitlements. */
const ACTIVE_STATUSES = ["trialing", "active", "past_due"];
/** Only the paid ladder can be sold as a one-time licence. */
const SELLABLE_TIERS: PlanTierDb[] = ["creator", "studio", "agency"];

/**
 * Untyped view of the service client. The hand-maintained table map in
 * `supabase/types` carries no PostgREST select metadata, so the typed builder
 * collapses to `never`; naming the row shape per query keeps this honest — the
 * same trade-off the admin console makes.
 */
function service(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

interface LicenseRow {
  id: string;
  tier: PlanTierDb;
  redeemed_by: string | null;
  revoked_at: string | null;
}

/** SLX-XXXX-XXXX-XXXX, minus the glyphs people mistype when reading aloud. */
function mintCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]);
  return `SLX-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

/** Human-facing plan name for a tier. */
export function planName(tier: PlanTierDb): string {
  return tier === "free" ? "Free" : (getPlan(tier as PlanTier)?.name ?? "Free");
}

export function isPaidTier(tier: PlanTierDb): boolean {
  return tier !== "free";
}

/** Active plan tier for a specific user, or "free" when they've never paid. */
export async function tierForUser(userId: string): Promise<PlanTierDb> {
  if (!isSupabaseConfigured()) return "studio";

  const { data } = await service()
    .from("subscriptions")
    .select("tier")
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();
  return (data as { tier: PlanTierDb } | null)?.tier ?? "free";
}

/** Active plan tier for the signed-in user, or "free". */
export async function getCurrentTier(): Promise<PlanTierDb> {
  if (!isSupabaseConfigured()) return "studio";
  const session = await getSession();
  if (!session) return "free";
  return tierForUser(session.userId);
}

/**
 * Apply a tier to a user by updating their active subscription, or creating one
 * if they have none. Keeps the "one active subscription per user" invariant the
 * database enforces.
 */
async function grantTier(
  db: SupabaseClient,
  userId: string,
  tier: PlanTierDb,
): Promise<boolean> {
  const grant = {
    tier,
    billing: "lifetime",
    status: "active",
    current_period_end: null,
    provider: "license",
    external_id: null,
  };

  const { data: existing } = await db
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("subscriptions")
      .update(grant)
      .eq("id", (existing as { id: string }).id);
    return !error;
  }

  const { error } = await db
    .from("subscriptions")
    .insert({ user_id: userId, ...grant });
  return !error;
}

/**
 * Redeem a one-time licence code for the signed-in user.
 *
 * The code is claimed with a conditional update so a second redemption of the
 * same key can never win a race, then its tier is applied to the caller's
 * subscription. This runs under the service role on purpose: users have no
 * write access to the billing tables under row-level security, and they must
 * never be able to read or claim a code that isn't theirs.
 */
export async function redeemLicense(rawCode: string): Promise<RedeemResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Licences aren't available in demo mode." };
  }

  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Your session expired — sign in and try again." };
  }

  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter your licence key." };

  const db = service();

  const { data } = await db
    .from("licenses")
    .select("id, tier, redeemed_by, revoked_at")
    .eq("code", code)
    .maybeSingle();
  const license = data as LicenseRow | null;

  if (!license) return { ok: false, error: "That licence key isn't valid." };
  if (license.revoked_at) {
    return { ok: false, error: "This licence has been revoked." };
  }
  if (license.redeemed_by) {
    return {
      ok: false,
      error:
        license.redeemed_by === session.userId
          ? "You've already activated this licence."
          : "This licence has already been used.",
    };
  }

  // Claim it atomically — the null filters make a double-redeem impossible.
  const { data: claimed } = await db
    .from("licenses")
    .update({
      redeemed_by: session.userId,
      redeemed_at: new Date().toISOString(),
    })
    .eq("id", license.id)
    .is("redeemed_by", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (!claimed) {
    return { ok: false, error: "That licence was just used. Try another." };
  }

  const granted = await grantTier(db, session.userId, license.tier);
  if (!granted) {
    // Release the claim so a transient failure doesn't burn the code.
    await db
      .from("licenses")
      .update({ redeemed_by: null, redeemed_at: null })
      .eq("id", license.id);
    return {
      ok: false,
      error: "Couldn't apply the plan just now. Please try again.",
    };
  }

  return { ok: true, tier: license.tier, plan: planName(license.tier) };
}

/** Mint and persist a batch of licence codes. Platform admins only. */
export async function createLicenseBatch(input: {
  tier: PlanTierDb;
  quantity: number;
  note?: string;
}): Promise<GenerateResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Licences aren't available in demo mode." };
  }

  const session = await getSession();
  if (!session?.isAdmin) {
    return { ok: false, error: "Only platform admins can mint codes." };
  }

  if (!SELLABLE_TIERS.includes(input.tier)) {
    return { ok: false, error: "Pick a sellable tier." };
  }
  const quantity = Math.min(500, Math.max(1, Math.round(input.quantity) || 1));
  const note = input.note?.trim() || null;

  const codes = Array.from({ length: quantity }, mintCode);
  const { error } = await service()
    .from("licenses")
    .insert(codes.map((code) => ({ code, tier: input.tier, note })));

  if (error) {
    return { ok: false, error: "Couldn't save the batch. Please try again." };
  }
  return { ok: true, codes };
}
