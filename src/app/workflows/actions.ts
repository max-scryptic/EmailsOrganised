"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { SavedWorkflow } from "@/lib/workflow-data";
import { workflowFromRow } from "@/lib/workflows";
import {
  saveWorkflowInputSchema,
  workflowIdSchema,
  type SaveWorkflowInput,
} from "@/lib/workflow-validation";

type WorkflowMutationResult =
  | {
      status: "success";
      title: string;
      description: string;
      workflow?: SavedWorkflow;
      deletedId?: string;
    }
  | {
      status: "error";
      title: string;
      description: string;
    };

type WorkflowMutationRow = {
  id: string;
  name: string;
  detail: string;
  status: "live" | "paused" | "draft";
  owner_role: string;
  trigger: string;
  classifier_prompt: string;
  outcomes: unknown;
  created_at: string;
  updated_at: string;
};

export async function saveWorkflow(
  input: SaveWorkflowInput
): Promise<WorkflowMutationResult> {
  const parsed = saveWorkflowInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      title: "Workflow was not saved",
      description:
        parsed.error.issues[0]?.message ?? "Check the workflow and try again.",
    };
  }

  if (!isSupabaseConfigured) {
    return {
      status: "error",
      title: "Supabase is not configured",
      description:
        "Set the Supabase environment variables before saving workflows.",
    };
  }

  const user = await requireUser();
  const supabase = await createClient();
  const values = {
    name: parsed.data.name,
    detail: parsed.data.detail,
    status: parsed.data.status ?? "draft",
    owner_role: parsed.data.ownerRole,
    trigger: parsed.data.trigger,
    classifier_prompt: parsed.data.classifierPrompt,
    outcomes: parsed.data.outcomes,
  };

  const query = parsed.data.id
    ? supabase
        .from("workflows")
        .update(values)
        .eq("id", parsed.data.id)
        .eq("user_id", user.id)
    : supabase.from("workflows").insert({ ...values, user_id: user.id });

  const { data, error } = await query
    .select(
      "id, name, detail, status, owner_role, trigger, classifier_prompt, outcomes, created_at, updated_at"
    )
    .single();

  if (error) {
    return {
      status: "error",
      title: "Workflow was not saved",
      description: error.message,
    };
  }

  revalidatePath("/workflows");
  if (parsed.data.id) {
    revalidatePath(`/workflows/${parsed.data.id}`);
  }

  return {
    status: "success",
    title: parsed.data.id ? "Workflow updated" : "Workflow created",
    description: `${parsed.data.name} is saved in the database.`,
    workflow: workflowFromRow(data as WorkflowMutationRow),
  };
}

export async function deleteWorkflow(
  id: string
): Promise<WorkflowMutationResult> {
  const parsedId = workflowIdSchema.safeParse(id);

  if (!parsedId.success) {
    return {
      status: "error",
      title: "Workflow was not deleted",
      description: "The workflow id is invalid.",
    };
  }

  if (!isSupabaseConfigured) {
    return {
      status: "error",
      title: "Supabase is not configured",
      description:
        "Set the Supabase environment variables before deleting workflows.",
    };
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("workflows")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id);

  if (error) {
    return {
      status: "error",
      title: "Workflow was not deleted",
      description: error.message,
    };
  }

  revalidatePath("/workflows");
  revalidatePath(`/workflows/${parsedId.data}`);

  return {
    status: "success",
    title: "Workflow deleted",
    description: "The workflow has been removed from the database.",
    deletedId: parsedId.data,
  };
}
