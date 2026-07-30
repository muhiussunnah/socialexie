import type { Metadata } from "next";
import { DraftNotice } from "@/components/legal-draft-notice";
import { LegalPageSchema } from "@/components/legal-page-schema";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Socialexie collects, why, and what it never does.",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <LegalPageSchema path="/legal/privacy" name="Privacy" />
      <h1>Privacy</h1>
      <p>
        Plain language, describing what the product actually does rather than
        reserving every right imaginable.
      </p>
      <DraftNotice />

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your email address, and a name and
          avatar if you provide them.
        </li>
        <li>
          <strong>Content you create</strong> — posts, captions, media, schedules
          and the categories you sort them into.
        </li>
        <li>
          <strong>Connected channels</strong> — the account handle, display name
          and the access tokens needed to publish on your behalf.
        </li>
        <li>
          <strong>Performance data</strong> — the reach, share, save and comment
          figures the networks report back for posts we published.
        </li>
        <li>
          <strong>Operational logs</strong> — request and error records used to
          keep publishing reliable.
        </li>
      </ul>

      <h2>What we do with it</h2>
      <p>
        We use it to run the product: to publish what you scheduled, to show you
        how it performed, to enforce plan limits, and to investigate failures.
        We do not sell it, we do not share it with advertisers, and we do not
        use your content to train models.
      </p>

      <h2>AI generation</h2>
      <p>
        When you generate an image or caption, the prompt and any settings you
        chose are sent to the model provider you selected. Those providers have
        their own terms and retention policies. If you would rather not send a
        prompt to a third party, do not use the AI studio for that task.
      </p>

      <h2>Who can see your data</h2>
      <p>
        People you invite to your workspace, and nobody else. Isolation is
        enforced in the database with row-level security rather than only in
        application code. Platform staff can see aggregate usage and account
        metadata for support and billing; they do not browse your content
        casually, and administrative access is recorded in an audit log.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Content lives as long as your workspace does. Deleting a workspace
        removes its posts, media, schedules and connected channels. Disconnecting
        a channel deletes its stored tokens immediately. Analytics history is
        retained for the window your plan includes.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Export or delete your content at any time from settings.</li>
        <li>Disconnect any channel, which revokes our access to it.</li>
        <li>
          Close your account, which deletes your profile and every workspace you
          own.
        </li>
      </ul>
    </>
  );
}
