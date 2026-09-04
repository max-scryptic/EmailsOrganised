"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Trash2 } from "lucide-react";
import { deleteWorkflow } from "@/app/workflows/actions";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import type { SavedWorkflow } from "@/lib/workflow-data";

export function WorkflowDetailActions({
  workflow,
}: {
  workflow: SavedWorkflow;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [isPending, startTransition] = React.useTransition();

  async function confirmDelete() {
    const confirmed = await confirm({
      title: `Delete ${workflow.draft.name}?`,
      description:
        "The workflow stops running and its classifier, outcomes, and actions are removed. This cannot be undone.",
      confirmLabel: "Delete workflow",
    });

    if (confirmed) {
      startTransition(() => {
        void (async () => {
          const result = await deleteWorkflow(workflow.id);

          if (result.status === "success") {
            // The detail page is gone now -- do not leave it in the back stack.
            router.replace("/workflows");
          }
        })();
      });
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
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
        Delete workflow
      </Button>
      <ConfirmDialog />
    </>
  );
}
