import { Play, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/lib/template-data";
import { ceoWorkflowDraft } from "@/lib/workflow-data";

export default function WorkflowsPage() {
  return (
    <AppShell
      title="Workflows"
      description={`Build the mailbox routines ${appConfig.name} can classify, route, draft, and review.`}
      actions={
        <>
          <Button type="button" variant="outline">
            <Play className="size-4" />
            Run checks
          </Button>
          <Button type="button">
            <Plus className="size-4" />
            New workflow
          </Button>
        </>
      }
    >
      <WorkflowBuilder initialDraft={ceoWorkflowDraft} />
    </AppShell>
  );
}
