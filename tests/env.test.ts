import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MissingConfigError, isSupabaseConfigured, publicEnv } from "@/lib/env";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const ORIGINAL = Object.fromEntries(
  KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof KEYS)[number], string | undefined>;

const VALID_URL = "https://abcdefghijklmnop.supabase.co";
const VALID_KEY = "sb_publishable_0123456789abcdefghij";

function clear() {
  for (const key of KEYS) delete process.env[key];
}

function configure() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = VALID_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = VALID_KEY;
}

beforeEach(clear);

afterEach(() => {
  for (const key of KEYS) {
    const value = ORIGINAL[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("isSupabaseConfigured", () => {
  it("is false on a fresh clone with no environment at all", () => {
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is false when only one half of the pair is present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = VALID_URL;
    expect(isSupabaseConfigured()).toBe(false);

    clear();
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = VALID_KEY;
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is false when the variables are present but empty", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is false when the URL is not a URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "abcdefghijklmnop.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = VALID_KEY;
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is false when the key is too short to be a real one", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = VALID_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "short";
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is true with a valid URL and a plausible key", () => {
    configure();
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("never throws — pages rely on it to degrade rather than crash", () => {
    expect(() => isSupabaseConfigured()).not.toThrow();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "://nonsense";
    expect(() => isSupabaseConfigured()).not.toThrow();
  });
});

describe("publicEnv", () => {
  it("returns the parsed values once configured", () => {
    configure();
    expect(publicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: VALID_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID_KEY,
    });
  });

  it("throws MissingConfigError when nothing is configured", () => {
    expect(() => publicEnv()).toThrow(MissingConfigError);
  });

  it("names every missing key in the message", () => {
    let error: unknown;
    try {
      publicEnv();
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(MissingConfigError);
    const message = (error as Error).message;
    for (const key of KEYS) expect(message).toContain(key);
  });

  it("names only the key that is actually missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = VALID_URL;

    let message = "";
    try {
      publicEnv();
    } catch (caught) {
      message = (caught as Error).message;
    }

    expect(message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(message).toMatch(
      /configuration: NEXT_PUBLIC_SUPABASE_ANON_KEY\. Copy/,
    );
  });

  it("reports a malformed value, not just an absent one", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = VALID_KEY;

    expect(() => publicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("points at .env.example so the fix is obvious", () => {
    expect(() => publicEnv()).toThrow(/\.env\.example/);
  });
});

describe("MissingConfigError", () => {
  it("is a real Error with a stable name for instanceof checks", () => {
    const error = new MissingConfigError(["A_KEY"]);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("MissingConfigError");
    expect(error.message).toContain("A_KEY");
  });

  it("joins several keys into one readable list", () => {
    expect(new MissingConfigError(["A", "B"]).message).toContain("A, B");
  });
});
