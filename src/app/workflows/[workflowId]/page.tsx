import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { WorkflowDetail } from "@/components/workflows/workflow-detail";
import { WorkflowDetailActions } from "@/components/workflows/workflow-detail-actions";
import { getSavedWorkflow } from "@/lib/workflow-data";

export async function generateMetadata({
  params,
}: PageProps<"/workflows/[workflowId]">): Promise<Metadata> {
  const { workflowId } = await params;
  const workflow = getSavedWorkflow(workflowId);

  return { title: workflow ? workflow.draft.name : "Workflow" };
}

export default async function WorkflowDetailPage({
  params,
}: PageProps<"/workflows/[workflowId]">) {
  const { workflowId } = await params;
  const workflow = getSavedWorkflow(workflowId);

  if (!workflow) {
    notFound();
  }

  return (
    <AppShell
      title={workflow.draft.name}
      description={workflow.detail}
      breadcrumbs={[
        { title: "Workflows", href: "/workflows" },
        { title: workflow.draft.name },
      ]}
      actions={<WorkflowDetailActions workflow={workflow} />}
    >
      <WorkflowDetail workflow={workflow} />
    </AppShell>
  );
}
