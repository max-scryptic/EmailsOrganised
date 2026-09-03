import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { Button } from "@/components/ui/button";
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
      description={workflow.draft.detail}
      breadcrumbs={[
        { title: "Workflows", href: "/workflows" },
        { title: workflow.draft.name },
      ]}
      actions={
        <Button type="button" variant="outline">
          <Play className="size-4" />
          Run checks
        </Button>
      }
    >
      <WorkflowBuilder initialDraft={workflow.draft} />
    </AppShell>
  );
}
