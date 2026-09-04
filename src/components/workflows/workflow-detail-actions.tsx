"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteWorkflow } from "@/app/workflows/actions";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SavedWorkflow } from "@/lib/workflow-data";

type DeleteError = { title: string; description: string } | null;

export function WorkflowDetailActions({
  workflow,
}: {
  workflow: SavedWorkflow;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [error, setError] = React.useState<DeleteError>(null);
  const [isPending, startTransition] = React.useTransition();

  async function confirmDelete() {
    const confirmed = await confirm({
      title: `Delete ${workflow.draft.name}?`,
      description:
        "The workflow stops running and its classifier, outcomes, and actions are removed. This cannot be undone.",
      confirmLabel: "Delete workflow",
    });

    if (confirmed) {
      setError(null);
      startTransition(() => {
        void (async () => {
          const result = await deleteWorkflow(workflow.id);

          if (result.status === "success") {
            // The detail page is gone now -- do not leave it in the back stack.
            router.replace("/workflows");
          } else {
            // These actions render into the page header, which has no room for
            // an inline alert -- and staying silent here is what made a failed
            // delete look like a dead button.
            setError({ title: result.title, description: result.description });
          }
        })();
      });
    }
  }

  return (
    <>
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
      <AlertDialog
        open={Boolean(error)}
        onOpenChange={(open) => !open && setError(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{error?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {error?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setError(null)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
