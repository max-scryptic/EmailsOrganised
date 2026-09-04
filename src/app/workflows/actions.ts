"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import {
  defaultWorkflowNamePattern,
  defaultWorkflowNamePrefix,
  type SavedWorkflow,
} from "@/lib/workflow-data";
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
  // Naming a workflow is optional, so an unnamed one is numbered here rather
  // than in the builder — only the database knows what the user already has.
  const name =
    parsed.data.name ||
    (await nextDefaultWorkflowName(supabase, user.id, parsed.data.id));
  const values = {
    name,
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
      "id, name, status, owner_role, trigger, classifier_prompt, outcomes, created_at, updated_at"
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
    description: `${name} is saved in the database.`,
    workflow: workflowFromRow(data as WorkflowMutationRow),
  };
}

/**
 * The next free "New Workflow N" for this user. Numbering follows the highest
 * one already taken, so deleting a workflow never hands its number to a new
 * one. `currentId` is excluded so clearing an existing workflow's name does
 * not make it step over itself.
 */
async function nextDefaultWorkflowName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  currentId?: string
) {
  let query = supabase
    .from("workflows")
    .select("name")
    .eq("user_id", userId)
    .ilike("name", `${defaultWorkflowNamePrefix} %`);

  if (currentId) {
    query = query.neq("id", currentId);
  }

  const { data } = await query;
  const highest = ((data ?? []) as { name: string }[]).reduce((max, row) => {
    const match = defaultWorkflowNamePattern.exec(row.name.trim());

    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `${defaultWorkflowNamePrefix} ${highest + 1}`;
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
