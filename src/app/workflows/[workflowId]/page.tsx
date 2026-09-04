import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { WorkflowDetail } from "@/components/workflows/workflow-detail";
import { WorkflowDetailActions } from "@/components/workflows/workflow-detail-actions";
import { getWorkflow } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/workflows/[workflowId]">): Promise<Metadata> {
  const { workflowId } = await params;
  const workflow = await getWorkflow(workflowId);

  return { title: workflow ? workflow.draft.name : "Workflow" };
}

export default async function WorkflowDetailPage({
  params,
}: PageProps<"/workflows/[workflowId]">) {
  const { workflowId } = await params;
  const workflow = await getWorkflow(workflowId);

  if (!workflow) {
    notFound();
  }

  return (
    <AppShell
      title={workflow.draft.name}
      description={workflow.draft.detail}
      breadcrumbs={[
        { title: "Workflows", href: "/workflows" },
        { title: workflow.draft.name },
      ]}
      // The builder owns the heading so the name and detail stay editable, and
      // the board fills everything under it.
      hideHeading
      fill
    >
      <WorkflowDetail
        workflow={workflow}
        actions={<WorkflowDetailActions workflow={workflow} />}
      />
    </AppShell>
  );
}
