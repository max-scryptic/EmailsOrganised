"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import type { SavedWorkflow } from "@/lib/workflow-data";
import { useWorkflowIsDeleted } from "@/lib/workflow-store";

export function WorkflowDetail({ workflow }: { workflow: SavedWorkflow }) {
  const router = useRouter();
  const isDeleted = useWorkflowIsDeleted(workflow.id);

  if (isDeleted) {
    return (
      <EmptyState
        icon={Trash2}
        title="This workflow was deleted"
        description="It no longer runs on your mailbox and there is nothing left to edit here."
        action={{
          label: "Back to workflows",
          onClick: () => router.replace("/workflows"),
        }}
      />
    );
  }

  return <WorkflowBuilder initialDraft={workflow.draft} />;
}
