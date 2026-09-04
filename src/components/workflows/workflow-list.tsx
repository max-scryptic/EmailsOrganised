"use client";

import { Workflow } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { WorkflowTable } from "@/components/workflows/workflow-table";
import type { SavedWorkflow } from "@/lib/workflow-data";

export function WorkflowList({ workflows }: { workflows: SavedWorkflow[] }) {
  if (workflows.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="No workflows yet"
        description="Create your first workflow to describe the email it should catch and what should happen next."
        action={{ label: "New workflow", href: "/workflows/new" }}
      />
    );
  }

  return <WorkflowTable workflows={workflows} />;
}
