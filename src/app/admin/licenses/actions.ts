"use server";

import { createLicenseBatch, type GenerateResult } from "@/lib/licenses";
import type { PlanTierDb } from "@/lib/supabase/types";

/** Mint and persist a batch of licence codes. Platform admins only. */
export async function generateLicensesAction(input: {
  tier: PlanTierDb;
  quantity: number;
  note?: string;
}): Promise<GenerateResult> {
  return createLicenseBatch(input);
}
