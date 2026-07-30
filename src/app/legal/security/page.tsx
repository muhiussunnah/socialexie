import type { Metadata } from "next";
import { LegalPageSchema } from "@/components/legal-page-schema";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Socialexie isolates workspace data, stores channel tokens and connects to social networks.",
  alternates: { canonical: "/legal/security" },
};

export default function SecurityPage() {
  return (
    <>
      <LegalPageSchema path="/legal/security" name="Security" />
      <h1>Security</h1>
      <p>
        A publishing tool holds the keys to someone&apos;s audience. This page
        describes what Socialexie actually does with them.
      </p>

      <h2>Tenant isolation</h2>
      <p>
        Every record that belongs to a customer hangs off a workspace, and every
        table has row-level security enabled with a deny-by-default posture.
        Access is granted only through workspace membership, checked inside the
        database rather than in application code, so a bug in a query cannot
        expose another tenant&apos;s rows.
      </p>

      <h2>Channel tokens</h2>
      <p>
        Access and refresh tokens are written and read only by the server. No
        client-side policy selects those columns, so they never reach the
        browser bundle or an API response. Tokens are scoped to the permissions
        each network requires for publishing and nothing broader.
      </p>

      <h2>Official APIs only</h2>
      <p>
        Every connection uses the network&apos;s documented API through its
        OAuth flow. Socialexie never asks for your social password, never
        automates a logged-in browser session, and never uses an unofficial
        endpoint. Those techniques are what get accounts restricted, and they
        are not worth the features they unlock.
      </p>

      <h2>Automation guardrails</h2>
      <p>
        Automated messaging is constrained in the product itself, not left to
        the operator to remember:
      </p>
      <ul>
        <li>
          Messages send only inside the 24-hour window a person opens by
          contacting you first.
        </li>
        <li>
          A unique constraint in the database caps automated replies at one per
          person per automation per day.
        </li>
        <li>Public replies rotate across variations and sends are rate-paced.</li>
        <li>
          Schedules that exceed roughly six posts a day raise a warning, because
          very high posting frequency is treated as spam by the networks.
        </li>
      </ul>

      <h2>Transport and headers</h2>
      <p>
        HTTPS is enforced with HSTS. The application sets a content security
        policy, denies framing, disables MIME sniffing, restricts referrers, and
        turns off camera, microphone and geolocation permissions entirely.
      </p>

      <h2>Reporting a vulnerability</h2>
      <p>
        If you find a security issue, please report it privately before
        disclosing it publicly, and give us a reasonable window to ship a fix.
        We will not pursue action against good-faith research that avoids
        privacy violations, data destruction and service disruption.
      </p>
    </>
  );
}
