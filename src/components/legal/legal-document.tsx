import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileClock } from "lucide-react";
import { legalUpdatedAt } from "@/lib/legal";

/**
 * Shared shell for the policy documents. Long-form prose is the one place in
 * the app that is plain HTML rather than composed components, so the element
 * styles are set once here instead of on every heading and list.
 */
export function LegalDocument({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Last updated {legalUpdatedAt}
        </p>
        <p className="text-base leading-7 text-foreground text-pretty">
          {summary}
        </p>
      </header>

      <Alert>
        <FileClock className="size-4" />
        <AlertTitle>Draft pending legal review</AlertTitle>
        <AlertDescription>
          This document describes how the product actually works today, but it
          has not yet been reviewed by a lawyer. It will be replaced before
          EmailsOrganised leaves its Google OAuth test-user cap.
        </AlertDescription>
      </Alert>

      <div className="space-y-6 text-sm leading-6 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:pl-1 [&_p+p]:mt-3 [&_section]:space-y-2 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
