"use client";

import { Workflow } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { WorkflowTable } from "@/components/workflows/workflow-table";
import type { SavedWorkflow } from "@/lib/workflow-data";
import { useVisibleWorkflows } from "@/lib/workflow-store";

export function WorkflowList({ workflows }: { workflows: SavedWorkflow[] }) {
  const visibleWorkflows = useVisibleWorkflows(workflows);

  if (visibleWorkflows.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="No workflows yet"
        description="Create your first workflow to describe the email it should catch and what should happen next."
      />
    );
  }

  return <WorkflowTable workflows={visibleWorkflows} />;
}
