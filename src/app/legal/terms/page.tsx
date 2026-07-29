import type { Metadata } from "next";
import { DraftNotice } from "@/components/legal-draft-notice";

export const metadata: Metadata = {
  title: "Terms",
  description: "The agreement between you and Socialexie.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p>
        The short version: use it for your own accounts, follow the networks&apos;
        rules, and we will keep the service running and your data yours.
      </p>
      <DraftNotice />

      <h2>Your account</h2>
      <p>
        You are responsible for what happens under your login and for the
        accounts you connect. Connect only channels you own or are authorised to
        manage. Keep your credentials to yourself.
      </p>

      <h2>Your content stays yours</h2>
      <p>
        You keep every right to the posts, media and captions you create here.
        You grant us only the permission needed to operate the service: to store
        your content, transform it for each network&apos;s requirements, and
        publish it where and when you scheduled it.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use Socialexie to:</p>
      <ul>
        <li>
          Publish content that is illegal, or that violates a connected
          network&apos;s own policies.
        </li>
        <li>
          Send unsolicited messages to people who have not contacted you first.
        </li>
        <li>
          Operate accounts you do not have permission to manage, or impersonate
          someone else.
        </li>
        <li>
          Attempt to bypass the guardrails that keep automated messaging inside
          platform limits.
        </li>
      </ul>
      <p>
        The networks can restrict or remove an account for reasons outside our
        control. We build to their documented rules, but we cannot guarantee any
        particular reach, growth or outcome, and no plan is sold on that basis.
      </p>

      <h2>Plans and payment</h2>
      <p>
        Monthly plans renew until you cancel, and cancelling stops the next
        renewal rather than refunding the current period. A one-time licence is
        charged once, never renews, and includes updates for the tier you
        purchased. Plan limits are enforced in the product and are listed on the
        pricing page.
      </p>

      <h2>Availability</h2>
      <p>
        We aim to keep publishing reliable and will tell you when something
        breaks. The service is provided as-is, and our liability is limited to
        what you paid us in the twelve months before the claim.
      </p>

      <h2>Ending the agreement</h2>
      <p>
        You can close your account at any time. We may suspend an account that
        breaks these terms or puts the service at risk, and we will explain why
        when we do.
      </p>
    </>
  );
}
