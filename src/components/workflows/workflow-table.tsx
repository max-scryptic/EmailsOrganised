import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const updatedAtFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function WorkflowTable({ workflows }: { workflows: SavedWorkflow[] }) {
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflows.map((workflow) => (
            <TableRow key={workflow.id} className="group relative">
              <TableCell className="px-4 py-3 align-top">
                <Link
                  href={`/workflows/${workflow.id}`}
                  className="font-medium outline-none after:absolute after:inset-0 after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  {workflow.draft.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {workflow.draft.ownerRole}
                </div>
              </TableCell>
              <TableCell className="max-w-md px-4 py-3 align-top text-muted-foreground whitespace-normal">
                {workflow.draft.detail}
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
