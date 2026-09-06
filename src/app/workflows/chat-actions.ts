"use server";

import { requireUser } from "@/lib/auth/session";
import {
  WorkflowChatError,
  draftWorkflow,
  type WorkflowChatMessage,
} from "@/lib/ai/draft-workflow";
import type { WorkflowDraft } from "@/lib/workflow-data";
import {
  buildDraftFromIntent,
  isIntentBuildable,
} from "@/lib/workflow-intent";
import {
  workflowChatInputSchema,
  workflowIntentSchema,
  type WorkflowChatInput,
} from "@/lib/workflow-validation";

export type WorkflowChatResult =
  | {
      status: "success";
      /** What the assistant says back. */
      reply: string;
      /**
       * The workflow as understood so far, already mapped through
       * `buildDraftFromIntent`. Built on the server so the ids it generates
       * stay put for the turn instead of churning on every render.
       */
      draft: WorkflowDraft | null;
      /** Whether that draft is worth opening in the builder yet. */
      canOpen: boolean;
    }
  | { status: "error"; title: string; description: string };

/**
 * One turn of the workflow setup chat.
 *
 * Signed in only, for the same reason `testClassification` is: this spends the
 * product's model budget, and an unauthenticated caller would make it an open
 * proxy to the API key.
 */
export async function draftWorkflowFromChat(
  input: WorkflowChatInput
): Promise<WorkflowChatResult> {
  const parsed = workflowChatInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      title: "That message could not be sent",
      description:
        parsed.error.issues[0]?.message ?? "Check the message and try again.",
    };
  }

  await requireUser();

  try {
    const answer = await draftWorkflow(
      parsed.data.messages as WorkflowChatMessage[]
    );

    return {
      status: "success",
      reply: answer.reply,
      ...draftFromAnswer(answer.intent),
    };
  } catch (error) {
    return {
      status: "error",
      title: "The assistant did not answer",
      description:
        error instanceof WorkflowChatError
          ? error.message
          : "The workflow could not be drafted. Try again.",
    };
  }
}

/**
 * Turns the model's view of the workflow into a draft, or into nothing.
 *
 * The intent is re-parsed here rather than trusted: structured outputs make the
 * shape near-certain, but this is the boundary where a model's answer becomes
 * something the builder will render, and the schema's defaults are what let a
 * half-described workflow through instead of losing the turn to it.
 */
function draftFromAnswer(intent: unknown) {
  if (!intent) {
    return { draft: null, canOpen: false };
  }

  const parsed = workflowIntentSchema.safeParse(intent);

  if (!parsed.success) {
    return { draft: null, canOpen: false };
  }

  return {
    draft: buildDraftFromIntent(parsed.data),
    canOpen: isIntentBuildable(parsed.data),
  };
}
