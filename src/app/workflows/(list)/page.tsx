import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/states/empty-state";
import { WorkflowTable } from "@/components/workflows/workflow-table";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/lib/template-data";
import { savedWorkflows } from "@/lib/workflow-data";

export default function WorkflowsPage() {
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
      {savedWorkflows.length > 0 ? (
        <WorkflowTable workflows={savedWorkflows} />
      ) : (
        <EmptyState
          icon={Workflow}
          title="No workflows yet"
          description="Create your first workflow to describe the email it should catch and what should happen next."
          action={{ label: "New workflow", href: "/workflows/new" }}
        />
      )}
    </AppShell>
  );
}
