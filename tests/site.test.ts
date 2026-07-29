import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { adminEmails, isAdminEmail, marketingNav, site } from "@/lib/site";

const ORIGINAL = process.env.ADMIN_EMAILS;

beforeEach(() => {
  delete process.env.ADMIN_EMAILS;
});

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.ADMIN_EMAILS;
  } else {
    process.env.ADMIN_EMAILS = ORIGINAL;
  }
});

describe("adminEmails", () => {
  it("falls back to the development account when unconfigured", () => {
    expect(adminEmails()).toEqual(["itsinjamul@gmail.com"]);
  });

  it("splits a comma-separated environment variable", () => {
    process.env.ADMIN_EMAILS = "one@example.com,two@example.com";
    expect(adminEmails()).toEqual(["one@example.com", "two@example.com"]);
  });

  it("normalises case and whitespace so config typos still resolve", () => {
    process.env.ADMIN_EMAILS = "  Ops@Example.COM ,\tSecond@Example.com  ";
    expect(adminEmails()).toEqual(["ops@example.com", "second@example.com"]);
  });

  it("drops empty entries from a trailing or doubled comma", () => {
    process.env.ADMIN_EMAILS = "one@example.com,,two@example.com,";
    expect(adminEmails()).toEqual(["one@example.com", "two@example.com"]);
  });

  it("returns nothing when the variable is set but blank", () => {
    process.env.ADMIN_EMAILS = "   ";
    expect(adminEmails()).toEqual([]);
  });

  it("re-reads the environment on every call", () => {
    process.env.ADMIN_EMAILS = "first@example.com";
    expect(adminEmails()).toEqual(["first@example.com"]);

    process.env.ADMIN_EMAILS = "second@example.com";
    expect(adminEmails()).toEqual(["second@example.com"]);
  });
});

describe("isAdminEmail", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "ops@example.com,owner@example.com";
  });

  it("matches a configured address", () => {
    expect(isAdminEmail("ops@example.com")).toBe(true);
    expect(isAdminEmail("owner@example.com")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isAdminEmail("OPS@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("Ops@Example.com")).toBe(true);
  });

  it("trims whitespace around the candidate", () => {
    expect(isAdminEmail("  ops@example.com  ")).toBe(true);
    expect(isAdminEmail("\tOPS@EXAMPLE.COM\n")).toBe(true);
  });

  it("rejects an address that is not on the list", () => {
    expect(isAdminEmail("intruder@example.com")).toBe(false);
  });

  it("rejects a near miss rather than matching loosely", () => {
    expect(isAdminEmail("ops@example.com.attacker.test")).toBe(false);
    expect(isAdminEmail("xops@example.com")).toBe(false);
    expect(isAdminEmail("ops@example.co")).toBe(false);
  });

  it("rejects absent or empty input", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail("   ")).toBe(false);
  });

  it("locks everyone out when the list is blank", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("ops@example.com")).toBe(false);
  });
});

describe("site metadata", () => {
  it("carries the values the layout and OpenGraph tags read", () => {
    expect(site.name).toBe("Socialexie");
    expect(site.domain).toBe("socialexie.app");
    expect(site.description.length).toBeGreaterThan(50);
  });

  it("exposes an absolute URL that metadataBase can parse", () => {
    expect(() => new URL(site.url)).not.toThrow();
    expect(site.url.startsWith("http")).toBe(true);
  });
});

describe("marketingNav", () => {
  it("points every item at a route or an anchor on the landing page", () => {
    for (const item of marketingNav) {
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate destinations", () => {
    const hrefs = marketingNav.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
