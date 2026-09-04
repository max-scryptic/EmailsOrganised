import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import type { SavedWorkflow } from "@/lib/workflow-data";

export function WorkflowDetail({ workflow }: { workflow: SavedWorkflow }) {
  return (
    <WorkflowBuilder
      initialDraft={workflow.draft}
      status={workflow.status}
      workflowId={workflow.id}
    />
  );
}
