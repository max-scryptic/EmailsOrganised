"use server";

import { revalidatePath } from "next/cache";
import {
  ClassificationError,
  classifyEmail,
  type EmailClassification,
} from "@/lib/ai/classify-email";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import {
  defaultWorkflowNamePattern,
  defaultWorkflowNamePrefix,
  type SavedWorkflow,
} from "@/lib/workflow-data";
import { applyVariables, sampleEmailValues } from "@/lib/workflow-variables";
import { workflowFromRow } from "@/lib/workflows";
import {
  classificationTestInputSchema,
  saveWorkflowInputSchema,
  workflowIdSchema,
  type ClassificationTestInput,
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
  /** Trigger → classification wire filter — see the note on `WorkflowRow`. */
  classifier_filter: unknown;
  /** Classification output labels — see the note on `WorkflowRow`. */
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
    classifier_filter: parsed.data.classifierFilter,
    outcomes: parsed.data.labels,
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
      "id, name, status, owner_role, trigger, classifier_prompt, classifier_filter, outcomes, created_at, updated_at"
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

type ClassificationTestResult =
  | { status: "success"; classification: EmailClassification }
  | { status: "error"; title: string; description: string };

/**
 * Runs the classification node against one made-up email, so the prompt and
 * the output labels can be checked before the workflow is pointed at a real
 * inbox.
 *
 * Signed in only: this spends the product's model budget, and an unauthenticated
 * caller would make it an open proxy to the API key.
 */
export async function testClassification(
  input: ClassificationTestInput
): Promise<ClassificationTestResult> {
  const parsed = classificationTestInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      title: "Nothing to test yet",
      description:
        parsed.error.issues[0]?.message ??
        "Check the prompt and the output labels.",
    };
  }

  await requireUser();

  const { subject, body, prompt, labels } = parsed.data;
  // The prompt is written against the values a real run carries, so the test
  // stands the sample email in for them rather than sending raw `{{tokens}}`.
  const values = sampleEmailValues({
    "email.subject": subject,
    "email.body.text": body,
    "email.snippet": body.slice(0, 120),
  });

  try {
    const classification = await classifyEmail({
      prompt: applyVariables(prompt, values),
      labels,
      email: {
        subject: subject || values["email.subject"],
        from: values["email.from.address"],
        body: body || values["email.body.text"],
      },
    });

    return { status: "success", classification };
  } catch (error) {
    return {
      status: "error",
      title: "The test did not run",
      description:
        error instanceof ClassificationError
          ? error.message
          : "The classification could not be run. Try again.",
    };
  }
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
