import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { createEmptyWorkflowDraft } from "@/lib/workflow-data";

export const metadata: Metadata = { title: "New workflow" };

export default function NewWorkflowPage() {
  return (
    <AppShell
      title="New workflow"
      description="Name what the classification can answer, then build the actions each answer runs. Naming the workflow is optional — an unnamed one is numbered for you."
      breadcrumbs={[
        { title: "Workflows", href: "/workflows" },
        { title: "New workflow" },
      ]}
      // The builder owns the heading so the name stays editable, and the board
      // fills everything under it.
      hideHeading
      fill
    >
      <WorkflowBuilder mode="new" initialDraft={createEmptyWorkflowDraft()} />
    </AppShell>
  );
}
