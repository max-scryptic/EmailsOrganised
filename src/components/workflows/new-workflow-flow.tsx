"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { WorkflowChat } from "@/components/workflows/workflow-chat";
import { cn } from "@/lib/utils";
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
 * to move one across a navigation are to save it first (which would leave a
 * row behind every time someone changed their mind) or to put it in session
 * storage and hope. Holding it in state costs one client component and makes
 * the handover exact.
 *
 * The two phases are a pair of tabs, not a one-way door: the builder can go
 * back to the chat to describe another change, and the chat can hand the board
 * back untouched. That is why neither phase is unmounted once it has been
 * opened: a transcript and a half-arranged board are both work, and work
 * survives switching tabs. Only a fresh hand-over from the chat replaces what
 * is on the board, and it says so on the button that does it.
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
  // The builder is mounted lazily and then kept, so the board a user has
  // arranged is still there when they come back from the chat.
  const [editorOpened, setEditorOpened] = React.useState(!chatConfigured);
  /**
   * Counts hand-overs from the chat, and keys the builder. A hand-over is the
   * one moment the board is meant to be replaced by what the conversation now
   * says, so the builder is remounted and reads the new draft as its starting
   * point; every other way back leaves it exactly as it was.
   */
  const [handover, setHandover] = React.useState(0);

  const openEditor = React.useCallback((built: WorkflowDraft | null) => {
    setDraft(built);
    setEditorOpened(true);
    setHandover((count) => count + 1);
    setView("editor");
  }, []);

  return (
    <>
      {chatConfigured ? (
        <Phase hidden={view !== "chat"}>
          <WorkflowChat
            onOpenEditor={openEditor}
            onReturnToEditor={
              editorOpened ? () => setView("editor") : undefined
            }
          />
        </Phase>
      ) : null}

      {editorOpened ? (
        <Phase hidden={view !== "editor"}>
          <WorkflowBuilder
            key={handover}
            mode="new"
            initialDraft={draft ?? createEmptyWorkflowDraft()}
            actions={
              chatConfigured ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setView("chat")}
                >
                  <MessageSquare className="size-4" />
                  Back to the chat
                </Button>
              ) : null
            }
          />
        </Phase>
      ) : null}
    </>
  );
}

/**
 * One phase's slot in the filling page. The hidden phase keeps its state and
 * its DOM: it is a tab that is not on top, not a page that was left.
 */
function Phase({
  hidden,
  children,
}: {
  hidden: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", hidden && "hidden")}>
      {children}
    </div>
  );
}
