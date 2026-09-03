import { WorkflowWorkspace } from "@/components/workflows/workflow-workspace";
import { appConfig } from "@/lib/template-data";
import { listWorkflows } from "@/lib/workflows";
import { ceoWorkflowDraft } from "@/lib/workflow-data";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const workflows = await listWorkflows();

  return (
    <WorkflowWorkspace
      appName={appConfig.name}
      initialDraft={ceoWorkflowDraft}
      initialWorkflows={workflows}
    />
  );
}
