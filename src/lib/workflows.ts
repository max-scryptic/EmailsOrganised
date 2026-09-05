import "server-only";

import { requireUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type {
  SavedWorkflow,
  WorkflowDraft,
  WorkflowStatus,
} from "@/lib/workflow-data";
import {
  workflowDraftSchema,
  workflowIdSchema,
} from "@/lib/workflow-validation";

type WorkflowRow = {
  id: string;
  name: string;
  status: WorkflowStatus;
  owner_role: string;
  trigger: string;
  classifier_prompt: string;
  /**
   * The classification node's output labels. The column is still called
   * `outcomes` from when a classification was a node of its own — the shape it
   * holds is `ClassificationLabel[]`, and the mapping happens here and in
   * `saveWorkflow` so nothing else has to know the old name.
   */
  outcomes: unknown;
  created_at: string;
  updated_at: string;
};

export async function listWorkflows(): Promise<SavedWorkflow[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflows")
    .select(
      "id, name, status, owner_role, trigger, classifier_prompt, outcomes, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load workflows: ${error.message}`);
  }

  return ((data ?? []) as WorkflowRow[]).map(workflowFromRow);
}

export function workflowFromRow(row: WorkflowRow): SavedWorkflow {
  const draft = workflowDraftSchema.parse({
    name: row.name,
    ownerRole: row.owner_role,
    trigger: row.trigger,
    classifierPrompt: row.classifier_prompt,
    // Rows written before labels moved into the classification node also carry
    // `description` and `examples` per entry; the schema drops them.
    labels: row.outcomes,
  }) satisfies WorkflowDraft;

  return {
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at,
    draft,
  };
}

export async function getWorkflow(id: string): Promise<SavedWorkflow | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  // Ids come straight off the URL. Anything that is not a uuid can never match
  // a row, and handing it to Postgres raises a type error the page would
  // surface as a crash instead of a 404.
  const parsedId = workflowIdSchema.safeParse(id);

  if (!parsedId.success) {
    return null;
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflows")
    .select(
      "id, name, status, owner_role, trigger, classifier_prompt, outcomes, created_at, updated_at"
    )
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load workflow: ${error.message}`);
  }

  return data ? workflowFromRow(data as WorkflowRow) : null;
}
