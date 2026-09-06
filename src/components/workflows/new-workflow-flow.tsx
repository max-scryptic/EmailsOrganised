"use client";

import * as React from "react";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { WorkflowChat } from "@/components/workflows/workflow-chat";
import {
  createEmptyWorkflowDraft,
  type WorkflowDraft,
} from "@/lib/workflow-data";

/**
 * Creating a workflow, in two phases: describe it in the chat, then open what
 * the chat understood in the builder.
 *
 * Both phases live on `/workflows/new` rather than on two routes, because the
 * thing being handed over is a whole `WorkflowDraft` and the only honest ways
 * to move one across a navigation are to save it first — which would leave a
 * row behind every time someone changed their mind — or to put it in session
 * storage and hope. Holding it in state costs one client component and makes
 * the handover exact.
 *
 * Nothing is written to the database in either phase. The builder saves on the
 * user's say-so, exactly as it does today, so a workflow that came out of a
 * chat is a workflow like any other from the moment it lands on the board.
 */
export function NewWorkflowFlow({ chatConfigured }: { chatConfigured: boolean }) {
  const [draft, setDraft] = React.useState<WorkflowDraft | null>(null);
  const [view, setView] = React.useState<"chat" | "editor">(
    // With no API key there is no conversation to have, so the chat would only
    // be a wall explaining itself. Going straight to the board keeps the page
    // working the way it did before the chat existed.
    chatConfigured ? "chat" : "editor"
  );

  if (view === "editor") {
    return (
      <WorkflowBuilder
        mode="new"
        initialDraft={draft ?? createEmptyWorkflowDraft()}
      />
    );
  }

  return (
    <WorkflowChat
      onOpenEditor={(built) => {
        setDraft(built);
        setView("editor");
      }}
    />
  );
}
