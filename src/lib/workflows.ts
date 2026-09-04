import "server-only";

import { requireUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type {
  SavedWorkflow,
  WorkflowDraft,
  WorkflowStatus,
} from "@/lib/workflow-data";
import { workflowDraftSchema } from "@/lib/workflow-validation";

type WorkflowRow = {
  id: string;
  name: string;
  detail: string;
  status: WorkflowStatus;
  owner_role: string;
  trigger: string;
  classifier_prompt: string;
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
      "id, name, detail, status, owner_role, trigger, classifier_prompt, outcomes, created_at, updated_at"
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
    detail: row.detail,
    ownerRole: row.owner_role,
    trigger: row.trigger,
    classifierPrompt: row.classifier_prompt,
    outcomes: row.outcomes,
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

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflows")
    .select(
      "id, name, detail, status, owner_role, trigger, classifier_prompt, outcomes, created_at, updated_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load workflow: ${error.message}`);
  }

  return data ? workflowFromRow(data as WorkflowRow) : null;
}
