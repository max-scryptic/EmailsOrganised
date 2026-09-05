import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { legalContactEmail, legalRoutes } from "@/lib/legal";
import { appConfig } from "@/lib/template-data";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      summary={`${appConfig.name} works inside your mailbox, so this policy is specific about what we read, what we keep, and what we never do with it.`}
    >
      <section>
        <h2>1. What we collect</h2>
        <ul>
          <li>
            <strong className="text-foreground">Account details.</strong> The
            name, email address, profile picture, and Google account identifier
            that Google returns when you sign in.
          </li>
          <li>
            <strong className="text-foreground">Mailbox access tokens.</strong>{" "}
            The credentials Google issues so we can reach your mailbox on your
            behalf, along with the scopes you granted and when you granted them.
          </li>
          <li>
            <strong className="text-foreground">Mail content.</strong> The
            messages, attachments, drafts, and metadata we read from your
            mailbox in order to organise it.
          </li>
          <li>
            <strong className="text-foreground">Usage and diagnostics.</strong>{" "}
            Logs of requests and errors, used to keep the service working and
            secure.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Why we use it</h2>
        <p>
          We use your data to run the features you asked for: signing you in,
          organising your mailbox, preparing drafts, and sending the messages
          you tell us to send. We also use it to secure the service, debug
          failures, and meet legal obligations.
        </p>
        <p>
          We do not sell your data. We do not use the contents of your mailbox
          for advertising, and we do not use it to train generalised AI models.
        </p>
      </section>

      <section>
        <h2>3. Google user data</h2>
        <p>
          {appConfig.name} requests the{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
            gmail.modify
          </code>{" "}
          scope, which allows reading messages, creating and updating drafts,
          and sending — but not permanent deletion. Our use of information
          received from Google APIs adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements.
        </p>
        <p>
          You can review and revoke that access at any time at{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </section>

      <section>
        <h2>4. How it is stored and protected</h2>
        <p>
          Data is held in our Supabase project, encrypted in transit and at
          rest. Access is scoped per user by row-level security, so one
          account&apos;s data is not reachable from another&apos;s session.
        </p>
        <p>
          Google mailbox credentials are held in a separate table that no user
          session can read at all — it is reachable only by server-side code
          holding a service key, and only to make requests you have asked for.
        </p>
      </section>

      <section>
        <h2>5. Who else sees it</h2>
        <p>
          We share data only with the processors that make the service run —
          currently our hosting provider, our database provider, and, on paid
          plans, our payment processor, which handles card details directly so
          that we never hold them. We also disclose data where the law requires
          it. We do not share your mailbox content with anyone else.
        </p>
      </section>

      <section>
        <h2>6. How long we keep it</h2>
        <p>
          We keep your account data for as long as your account exists. When you
          delete your account, your profile and stored Google credentials are
          deleted, and derived mailbox data is removed within 30 days, except
          where we must keep records longer to meet a legal or accounting
          obligation. Revoking mailbox access in Google stops all further access
          immediately.
        </p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>
          Depending on where you live, you may have the right to access, correct,
          export, or delete your personal data, to object to or restrict some
          processing, and to complain to your data protection authority. Ask us
          at the address below and we will action it.
        </p>
      </section>

      <section>
        <h2>8. Changes and contact</h2>
        <p>
          If we change this policy we will update the date at the top and tell
          you about material changes before they take effect. See also the{" "}
          <Link href={legalRoutes.terms}>Terms and Conditions</Link>. Privacy
          questions and rights requests go to{" "}
          <a href={`mailto:${legalContactEmail}`}>{legalContactEmail}</a>.
        </p>
      </section>
    </LegalDocument>
  );
}
