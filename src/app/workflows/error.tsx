"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for every workflows route: the list, the detail board, and
 * the new-workflow flow.
 *
 * Without this, anything the loaders throw — a Supabase column the deployed
 * database does not have yet, a dropped connection — climbs to the root
 * boundary in `src/app/error.tsx`, which replaces the entire app with a bare
 * "unexpected render failure" panel. That reads as the product being broken
 * rather than one surface failing to load, and it strips the sidebar the user
 * needs to get anywhere else.
 *
 * Keeping the shell means the failure stays scoped to the content area, Retry
 * re-runs the loader, and the digest is on screen to match against the
 * deployment logs.
 */
export default function WorkflowsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppShell
      title="Workflows"
      breadcrumbs={[
        { title: "Workflows", href: "/workflows" },
        { title: "Error" },
      ]}
    >
      <div className="space-y-4">
        <ErrorState
          title="Workflows could not be loaded"
          description="The request to load your workflows did not complete. Retry, and if it keeps failing the deployment logs will have the detail."
          onRetry={reset}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/">Return home</Link>
          </Button>
          {error.digest ? (
            <p className="text-sm text-muted-foreground">
              Reference <code className="font-mono">{error.digest}</code>
            </p>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
