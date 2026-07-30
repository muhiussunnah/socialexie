export const site = {
  name: "Socialexie",
  domain: "socialexi.app",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://socialexi.app",
  tagline: "The control room for social growth.",
  description:
    "Plan, generate and publish across every network from one desk. Multi-platform scheduling, an AI image studio, evergreen recycling and compliant comment-to-DM automation.",
} as const;

/**
 * Accounts that may open the admin console. Configured through the environment
 * in production; the fallback keeps local development usable.
 *
 * This list is only ever read on the server — see `lib/auth/roles.ts`.
 */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "itsinjamul@gmail.com";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

export const marketingNav = [
  { href: "/#features", label: "Features" },
  { href: "/#studio", label: "AI Studio" },
  { href: "/#automation", label: "Automation" },
  { href: "/pricing", label: "Pricing" },
] as const;
