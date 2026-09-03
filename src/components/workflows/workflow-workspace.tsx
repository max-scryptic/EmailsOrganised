"use client";

import * as React from "react";
import { Play, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import type { SavedWorkflow, WorkflowDraft } from "@/lib/workflow-data";

type WorkflowWorkspaceProps = {
  appName: string;
  initialDraft: WorkflowDraft;
  initialWorkflows: SavedWorkflow[];
};

export function WorkflowWorkspace({
  appName,
  initialDraft,
  initialWorkflows,
}: WorkflowWorkspaceProps) {
  const [newWorkflowRequest, setNewWorkflowRequest] = React.useState(0);

  return (
    <AppShell
      title="Workflows"
      description={`Build the mailbox routines ${appName} can classify, route, draft, and review.`}
      actions={
        <>
          <Button type="button" variant="outline">
            <Play className="size-4" />
            Run checks
          </Button>
          <Button
            type="button"
            onClick={() => setNewWorkflowRequest((request) => request + 1)}
          >
            <Plus className="size-4" />
            New workflow
          </Button>
        </>
      }
    >
      <WorkflowBuilder
        initialDraft={initialDraft}
        initialWorkflows={initialWorkflows}
        newWorkflowRequest={newWorkflowRequest}
      />
    </AppShell>
  );
}
