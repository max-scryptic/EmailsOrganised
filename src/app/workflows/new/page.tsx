import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { createEmptyWorkflowDraft } from "@/lib/workflow-data";

export const metadata: Metadata = { title: "New workflow" };

export default function NewWorkflowPage() {
  return (
    <AppShell
      title="New workflow"
      description="Name it and describe what it does, then build the filter branches and the actions each one runs."
      breadcrumbs={[
        { title: "Workflows", href: "/workflows" },
        { title: "New workflow" },
      ]}
    >
      <WorkflowBuilder mode="new" initialDraft={createEmptyWorkflowDraft()} />
    </AppShell>
  );
}
