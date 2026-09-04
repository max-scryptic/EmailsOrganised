export type WorkflowActionType =
  | "forward"
  | "draft_reply"
  | "apply_label"
  | "archive";

export type WorkflowAction = {
  id: string;
  type: WorkflowActionType;
  labelName: string;
  forwardTo: string;
  subjectPrefix: string;
  note: string;
  signature: string;
  includeOriginalThread: boolean;
  markHandled: boolean;
  draftInstructions: string;
  draftTone: string;
  requireApproval: boolean;
};

export type WorkflowOutcome = {
  id: string;
  name: string;
  description: string;
  examples: string;
  actions: WorkflowAction[];
};

export type WorkflowDraft = {
  name: string;
  /** One-line summary of what the workflow does, shown in the workflows list. */
  detail: string;
  ownerRole: string;
  trigger: string;
  classifierPrompt: string;
  outcomes: WorkflowOutcome[];
};

export type WorkflowStatus = "live" | "paused" | "draft";

/**
 * A workflow as it appears in the workflows list. `draft` is everything the
 * builder edits on the detail page, including the name and detail line.
 */
export type SavedWorkflow = {
  id: string;
  status: WorkflowStatus;
  updatedAt: string;
  draft: WorkflowDraft;
};

export const workflowStatusLabels: Record<WorkflowStatus, string> = {
  live: "Live",
  paused: "Paused",
  draft: "Draft",
};

export const actionLabels: Record<WorkflowActionType, string> = {
  forward: "Forward email",
  draft_reply: "Draft reply",
  apply_label: "Tag email",
  archive: "Archive",
};

export function createWorkflowAction(
  type: WorkflowActionType,
  overrides: Partial<WorkflowAction> = {}
): WorkflowAction {
  return {
    id:
      overrides.id ??
      `action-${type}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    labelName: "",
    forwardTo: "",
    subjectPrefix: "",
    note: "",
    signature: "",
    includeOriginalThread: true,
    markHandled: false,
    draftInstructions: "",
    draftTone: "Professional and concise",
    requireApproval: true,
    ...overrides,
  };
}

/** The one email event every workflow starts from. */
export const defaultWorkflowTrigger = "Email arrives in primary inbox";

/** The blank slate the builder opens with on `/workflows/new`. */
export function createEmptyWorkflowDraft(): WorkflowDraft {
  return {
    name: "",
    detail: "",
    ownerRole: "",
    trigger: defaultWorkflowTrigger,
    classifierPrompt: "",
    outcomes: [],
  };
}
