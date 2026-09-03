"use client";

import { useRouter } from "next/navigation";
import { Play, Trash2 } from "lucide-react";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import type { SavedWorkflow } from "@/lib/workflow-data";
import { deleteWorkflow, useWorkflowIsDeleted } from "@/lib/workflow-store";

export function WorkflowDetailActions({
  workflow,
}: {
  workflow: SavedWorkflow;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const isDeleted = useWorkflowIsDeleted(workflow.id);

  if (isDeleted) {
    return null;
  }

  async function confirmDelete() {
    const confirmed = await confirm({
      title: `Delete ${workflow.draft.name}?`,
      description:
        "The workflow stops running and its classifier, outcomes, and actions are removed. This cannot be undone.",
      confirmLabel: "Delete workflow",
    });

    if (confirmed) {
      deleteWorkflow(workflow.id);
      // The detail page is gone now — don't leave it in the back stack.
      router.replace("/workflows");
    }
  }

  return (
    <>
      <Button type="button" variant="outline">
        <Play className="size-4" />
        Run checks
      </Button>
      <Button
        type="button"
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={confirmDelete}
      >
        <Trash2 className="size-4" />
        Delete workflow
      </Button>
      <ConfirmDialog />
    </>
  );
}
