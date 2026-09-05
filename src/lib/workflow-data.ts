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
  /**
   * Whether the action takes the email's files with it. Only forwarding and
   * drafting a reply can — tagging and archiving leave the message where its
   * attachments already are.
   */
  includeAttachments: boolean;
  markHandled: boolean;
  draftInstructions: string;
  draftTone: string;
  requireApproval: boolean;
};

/**
 * One answer the classification step is allowed to give — "Sales", "FAQ",
 * "Important" — and the actions that run when it gives it.
 *
 * The name is not decoration: it is handed to the model as the only set of
 * answers it may return, and it is the branch the actions hang off on the
 * canvas. One label, one output.
 */
export type ClassificationLabel = {
  id: string;
  name: string;
  actions: WorkflowAction[];
};

export type WorkflowDraft = {
  /**
   * Blank is allowed: saving an unnamed workflow gives it the next
   * `New Workflow N` name instead of refusing the save.
   */
  name: string;
  ownerRole: string;
  trigger: string;
  classifierPrompt: string;
  labels: ClassificationLabel[];
};

export type WorkflowStatus = "live" | "paused" | "draft";

/**
 * A workflow as it appears in the workflows list. `draft` is everything the
 * builder edits on the detail page, including the name.
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
    // On by default: a forward that silently drops the invoice is the bug, not
    // the feature.
    includeAttachments: true,
    markHandled: false,
    draftInstructions: "",
    draftTone: "Professional and concise",
    requireApproval: true,
    ...overrides,
  };
}

export function createClassificationLabel(
  overrides: Partial<ClassificationLabel> = {}
): ClassificationLabel {
  return {
    id: overrides.id ?? `label-${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    actions: [],
    ...overrides,
  };
}

/**
 * Labels the model can actually be forced onto: named, and named only once.
 * A blank name has nothing to answer with, and two identical names would give
 * the same answer two branches.
 */
export function usableClassificationLabels(labels: ClassificationLabel[]) {
  const seen = new Set<string>();

  return labels.filter((label) => {
    const name = label.name.trim();

    if (!name || seen.has(name.toLowerCase())) {
      return false;
    }

    seen.add(name.toLowerCase());

    return true;
  });
}

/** The one email event every workflow starts from. */
export const defaultWorkflowTrigger = "Email arrives in primary inbox";

/**
 * Workflows saved without a name are numbered from this prefix — the first is
 * "New Workflow 1", the next "New Workflow 2", and so on per user.
 */
export const defaultWorkflowNamePrefix = "New Workflow";

/** Matches a name this app generated, so the next number can follow it. */
export const defaultWorkflowNamePattern = new RegExp(
  `^${defaultWorkflowNamePrefix}\\s+(\\d+)$`,
  "i"
);

/** The blank slate the builder opens with on `/workflows/new`. */
export function createEmptyWorkflowDraft(): WorkflowDraft {
  return {
    name: "",
    ownerRole: "",
    trigger: defaultWorkflowTrigger,
    classifierPrompt: "",
    labels: [],
  };
}
