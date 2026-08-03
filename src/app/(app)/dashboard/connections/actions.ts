"use server";

import {
  disconnectConnection,
  saveConnection,
  testConnection,
  type SaveConnectionInput,
  type SaveResult,
  type TestResult,
} from "@/lib/ai/connections";

/** Connect or update a provider — the key never leaves the server. */
export async function saveConnectionAction(
  input: SaveConnectionInput,
): Promise<SaveResult> {
  return saveConnection(input);
}

/** Validate the stored key against the provider and record the result. */
export async function testConnectionAction(
  provider: string,
): Promise<TestResult> {
  return testConnection(provider);
}

/** Remove a provider connection and its stored key. */
export async function disconnectConnectionAction(
  provider: string,
): Promise<SaveResult> {
  return disconnectConnection(provider);
}
