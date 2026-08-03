import { z } from "zod";

/**
 * Environment access.
 *
 * Validation is lazy on purpose: the marketing pages must render on a fresh
 * clone with no `.env` at all, so a missing key only throws at the moment a
 * feature that needs it is actually used.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

/**
 * Secrets the real publishing pipeline needs — the AES key that opens stored
 * OAuth tokens and the shared secret guarding the cron endpoint. Validated
 * together and lazily, so nothing here is required until a publish actually
 * runs; marketing and demo pages never touch it.
 */
const socialSchema = z.object({
  // Base64 for 32 raw bytes (AES-256). `crypto.ts` checks the decoded length.
  SOCIAL_TOKEN_ENC_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

export class MissingConfigError extends Error {
  constructor(keys: string[]) {
    super(
      `Missing environment configuration: ${keys.join(", ")}. ` +
        `Copy .env.example to .env.local and fill these in.`,
    );
    this.name = "MissingConfigError";
  }
}

function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  input: Record<string, unknown>,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new MissingConfigError(
      result.error.issues.map((issue) => String(issue.path[0])),
    );
  }
  return result.data;
}

export function publicEnv() {
  return parseOrThrow(publicSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function serverEnv() {
  return parseOrThrow(serverSchema, {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function socialEnv() {
  return parseOrThrow(socialSchema, {
    SOCIAL_TOKEN_ENC_KEY: process.env.SOCIAL_TOKEN_ENC_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  });
}

/** True when Supabase is wired up, so pages can degrade instead of crashing. */
export function isSupabaseConfigured(): boolean {
  return (
    publicSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }).success
  );
}
