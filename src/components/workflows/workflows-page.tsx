import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WorkflowList } from "@/components/workflows/workflow-list";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/lib/template-data";
import { listWorkflows } from "@/lib/workflows";

/**
 * The workflows list, shared by `/` and `/workflows` so the two routes cannot
 * drift apart again — `/` used to render hardcoded sample workflows through the
 * same table, which meant its delete button could never reach a real row.
 */
export async function WorkflowsPage() {
  const workflows = await listWorkflows();

  return (
    <AppShell
      title="Workflows"
      description={`The mailbox routines ${appConfig.name} runs for you. Open one to change how it classifies, routes, drafts, and reviews.`}
      actions={
        <Button asChild>
          <Link href="/workflows/new">
            <Plus className="size-4" />
            New workflow
          </Link>
        </Button>
      }
    >
      <WorkflowList workflows={workflows} />
    </AppShell>
  );
}
