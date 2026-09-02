import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { legalContactEmail, legalRoutes } from "@/lib/legal";
import { appConfig } from "@/lib/template-data";

export const metadata: Metadata = {
  title: "Terms and Conditions",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms and Conditions"
      summary={`These terms cover your use of ${appConfig.name}, a service that connects to your Google mailbox and helps you keep it organised.`}
    >
      <section>
        <h2>1. Agreeing to these terms</h2>
        <p>
          By creating an account you agree to these terms. If you are signing up
          on behalf of an organisation, you confirm you are allowed to accept
          them for that organisation.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <p>
          {appConfig.name} has no passwords of its own. You sign in with Google,
          and the Google account you sign in with is your account. Keeping that
          Google account secure is your responsibility, and anyone who can sign
          in to it can reach your {appConfig.name} data.
        </p>
        <p>
          You must be old enough to enter a contract where you live, and you may
          not use the service if we are barred from providing it to you under
          applicable law.
        </p>
      </section>

      <section>
        <h2>3. Mailbox access</h2>
        <p>
          When you sign up, Google asks you to grant access to your mailbox. We
          use that grant to read your mail, create and update drafts, and send
          messages you ask us to send. We do not send mail on your behalf unless
          you ask for it, and we do not permanently delete messages.
        </p>
        <p>
          You can withdraw that grant at any time from your Google account
          settings, which immediately stops our access. Doing so leaves parts of
          the service unable to work.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>You agree not to use {appConfig.name} to:</p>
        <ul>
          <li>send unsolicited bulk mail, phishing, or malware;</li>
          <li>
            access a mailbox you are not authorised to access, or impersonate
            someone else;
          </li>
          <li>
            break the law, infringe someone&apos;s rights, or breach Google&apos;s
            own terms for the account you connect;
          </li>
          <li>
            probe, overload, or interfere with the service or the infrastructure
            it runs on, or attempt to circumvent its limits.
          </li>
        </ul>
        <p>
          We may suspend an account that we reasonably believe is doing any of
          the above.
        </p>
      </section>

      <section>
        <h2>5. Your content</h2>
        <p>
          Your mail is yours. You keep every right you already had in it, and we
          claim none. You grant us only the permission we need to run the
          service for you: to store, process, and transmit your content in order
          to provide the features you use. That permission ends when you delete
          your account, subject to the retention described in the{" "}
          <Link href={legalRoutes.privacy}>Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>6. Plans and payment</h2>
        <p>
          Paid plans, where offered, are billed in advance for the period shown
          at checkout and renew automatically until cancelled. You can cancel at
          any time and keep access until the end of the period you have paid
          for. Fees already paid are not refunded except where the law requires
          it. Prices may change, and we will tell you before a change affects a
          renewal.
        </p>
      </section>

      <section>
        <h2>7. Availability and changes</h2>
        <p>
          We work to keep the service running, but we do not promise it will be
          uninterrupted or error-free. We may add, change, or remove features.
          If we make a change that materially reduces what the service does, we
          will give you reasonable notice where we can.
        </p>
      </section>

      <section>
        <h2>8. Ending the agreement</h2>
        <p>
          You may stop using {appConfig.name} and delete your account at any
          time. We may suspend or end your access if you materially breach these
          terms, or if we stop offering the service. Sections that by their
          nature should survive termination — your content rights, disclaimers,
          liability limits — do survive it.
        </p>
      </section>

      <section>
        <h2>9. Disclaimers and liability</h2>
        <p>
          The service is provided &ldquo;as is&rdquo;, without warranties beyond
          those that cannot be excluded by law. To the fullest extent the law
          allows, we are not liable for indirect or consequential loss, or for
          lost profits, revenue, or data. Nothing here limits liability that
          cannot lawfully be limited, including for death or personal injury
          caused by negligence, or for fraud.
        </p>
      </section>

      <section>
        <h2>10. Changes to these terms</h2>
        <p>
          We may update these terms. When we do, we will change the date at the
          top and, for material changes, tell you in the product or by email
          before they take effect. Continuing to use the service after that
          means you accept the updated terms.
        </p>
      </section>

      <section>
        <h2>11. Contact</h2>
        <p>
          Questions about these terms go to{" "}
          <a href={`mailto:${legalContactEmail}`}>{legalContactEmail}</a>.
        </p>
      </section>
    </LegalDocument>
  );
}
