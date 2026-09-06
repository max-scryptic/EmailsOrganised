"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { deleteWorkflow } from "@/app/workflows/actions";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type SavedWorkflow,
  type WorkflowStatus,
  workflowStatusLabels,
} from "@/lib/workflow-data";

const statusVariant: Record<WorkflowStatus, "default" | "secondary" | "outline"> =
  {
    live: "default",
    paused: "secondary",
    draft: "outline",
  };

type DeleteError = { title: string; description: string } | null;

const updatedAtFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function WorkflowRow({
  workflow,
  isDeleting,
  onDelete,
}: {
  workflow: SavedWorkflow;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  const router = useRouter();
  const href = `/workflows/${workflow.id}`;

  return (
    <TableRow
      className="cursor-pointer"
      onClick={(event) => {
        // The name is a real link — let it handle its own click (and any
        // interactive control we add to a row later).
        if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea, [role='button']")) {
          return;
        }
        // A modified click has no anchor to act on here, and selecting text in
        // the row should not navigate away.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        if (window.getSelection()?.toString()) {
          return;
        }
        router.push(href);
      }}
    >
      <TableCell className="px-4 py-3">
        <Link
          href={href}
          className="rounded-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {workflow.draft.name}
        </Link>
        {workflow.draft.ownerRole ? (
          <div className="text-xs text-muted-foreground">
            {workflow.draft.ownerRole}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="px-4 py-3">
        <Badge variant={statusVariant[workflow.status]}>
          {workflowStatusLabels[workflow.status]}
        </Badge>
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">
        {updatedAtFormatter.format(new Date(workflow.updatedAt))}
      </TableCell>
      <TableCell className="px-4 py-3 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${workflow.draft.name}`}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function WorkflowTable({ workflows }: { workflows: SavedWorkflow[] }) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<DeleteError>(null);
  const [isPending, startTransition] = React.useTransition();

  async function confirmDelete(workflow: SavedWorkflow) {
    const confirmed = await confirm({
      title: `Delete ${workflow.draft.name}?`,
      description:
        "The workflow stops running and its classification, outputs, and actions are removed. This cannot be undone.",
      confirmLabel: "Delete workflow",
    });

    if (confirmed) {
      setDeletingId(workflow.id);
      setError(null);
      startTransition(() => {
        void (async () => {
          const result = await deleteWorkflow(workflow.id);

          setDeletingId(null);
          if (result.status === "success") {
            router.refresh();
          } else {
            // Without this the row simply stops spinning and stays put, which
            // reads as the button doing nothing at all.
            setError({ title: result.title, description: result.description });
          }
        })();
      });
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>{error.title}</AlertTitle>
          <AlertDescription>{error.description}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="px-4">Workflow</TableHead>
              <TableHead className="w-40 px-4">Status</TableHead>
              <TableHead className="w-40 px-4">Last edited</TableHead>
              <TableHead className="w-16 px-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((workflow) => (
              <WorkflowRow
                key={workflow.id}
                workflow={workflow}
                isDeleting={isPending && deletingId === workflow.id}
                onDelete={() => confirmDelete(workflow)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog />
    </div>
  );
}
