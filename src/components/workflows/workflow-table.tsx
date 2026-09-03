"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Trash2 } from "lucide-react";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
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
import { deleteWorkflow } from "@/lib/workflow-store";

const statusVariant: Record<WorkflowStatus, "default" | "secondary" | "outline"> =
  {
    live: "default",
    paused: "secondary",
    draft: "outline",
  };

const updatedAtFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function WorkflowRow({
  workflow,
  onDelete,
}: {
  workflow: SavedWorkflow;
  onDelete: () => void;
}) {
  const router = useRouter();
  const href = `/workflows/${workflow.id}`;

  return (
    <TableRow
      className="group cursor-pointer"
      onClick={(event) => {
        // The name is a real link — let it handle its own click (and any
        // interactive control we add to a row later).
        if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea, [role='button']")) {
          return;
        }
        // A modified click has no anchor to act on here, and selecting the
        // detail text should not navigate away.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        if (window.getSelection()?.toString()) {
          return;
        }
        router.push(href);
      }}
    >
      <TableCell className="px-4 py-3 align-top">
        <Link
          href={href}
          className="rounded-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {workflow.draft.name}
        </Link>
        <div className="text-xs text-muted-foreground">
          {workflow.draft.ownerRole}
        </div>
      </TableCell>
      <TableCell className="max-w-md px-4 py-3 align-top text-muted-foreground whitespace-normal">
        {workflow.detail}
      </TableCell>
      <TableCell className="px-4 py-3 align-top">
        <Badge variant={statusVariant[workflow.status]}>
          {workflowStatusLabels[workflow.status]}
        </Badge>
      </TableCell>
      <TableCell className="px-4 py-3 align-top text-muted-foreground">
        {updatedAtFormatter.format(new Date(workflow.updatedAt))}
      </TableCell>
      <TableCell className="px-4 py-3 align-top">
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </TableCell>
      <TableCell className="px-2 py-3 align-top">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${workflow.draft.name}`}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function WorkflowTable({ workflows }: { workflows: SavedWorkflow[] }) {
  const { confirm, ConfirmDialog } = useConfirmDialog();

  async function confirmDelete(workflow: SavedWorkflow) {
    const confirmed = await confirm({
      title: `Delete ${workflow.draft.name}?`,
      description:
        "The workflow stops running and its classifier, outcomes, and actions are removed. This cannot be undone.",
      confirmLabel: "Delete workflow",
    });

    if (confirmed) {
      deleteWorkflow(workflow.id);
    }
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="px-4">Workflow</TableHead>
            <TableHead className="px-4">Detail</TableHead>
            <TableHead className="px-4">Status</TableHead>
            <TableHead className="px-4">Last edited</TableHead>
            <TableHead className="w-12 px-4">
              <span className="sr-only">Open</span>
            </TableHead>
            <TableHead className="w-12 px-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflows.map((workflow) => (
            <WorkflowRow
              key={workflow.id}
              workflow={workflow}
              onDelete={() => confirmDelete(workflow)}
            />
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog />
    </div>
  );
}
