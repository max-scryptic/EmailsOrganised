import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WorkflowList } from "@/components/workflows/workflow-list";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/lib/template-data";
import { listWorkflows } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const workflows = await listWorkflows();

  return (
    <AppShell
      title="Workflows"
      description={`The mailbox routines ${appConfig.name} runs for you. Open one to change how it classifies, routes, drafts, and reviews.`}
      actions={
        workflows.length > 0 ? (
          <Button asChild>
            <Link href="/workflows/new">
              <Plus className="size-4" />
              New workflow
            </Link>
          </Button>
        ) : null
      }
    >
      <WorkflowList workflows={workflows} />
    </AppShell>
  );
}
