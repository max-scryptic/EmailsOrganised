import { Plus, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/lib/template-data";
import { ceoWorkflowDraft } from "@/lib/workflow-data";

export default function WorkflowsPage() {
  return (
    <AppShell
      title="Workflows"
      description={`${appConfig.name} turns incoming email into classified, routed work.`}
      actions={
        <>
          <Button type="button" variant="outline">
            <Send className="size-4" />
            Test sample
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
