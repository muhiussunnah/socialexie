"use server";

import { redeemLicense, type RedeemResult } from "@/lib/licenses";

/** Redeem a one-time licence key for the signed-in user. */
export async function redeemLicenseAction(code: string): Promise<RedeemResult> {
  return redeemLicense(code);
}
