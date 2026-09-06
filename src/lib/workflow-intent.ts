import {
  createFilterCondition,
  createWorkflowFilter,
} from "@/lib/workflow-filters";
import {
  createClassificationLabel,
  createWorkflowAction,
  type ClassificationLabel,
  type WorkflowActionType,
  type WorkflowDraft,
  defaultWorkflowTrigger,
} from "@/lib/workflow-data";
import { variableExpression } from "@/lib/workflow-variables";

/**
 * What the chat's model call is allowed to describe, and the pure mapping from
 * it onto a real `WorkflowDraft`.
 *
 * The model never emits a `WorkflowDraft`. It emits this — a narrow shape with
 * no ids, no filters, and no action defaults — and `buildDraftFromIntent` turns
 * it into a draft through the same factories the builder uses. That split is
 * the whole safety story: a confused generation comes back as a workflow that
 * says the wrong thing, never as one that is structurally invalid, carries a
 * duplicate id, or quietly drops `requireApproval`.
 */

/** One action on a branch, with only the settings a description can decide. */
export type WorkflowActionIntent = {
  type: WorkflowActionType;
  /** Where a forward goes. Must be an address the user actually typed. */
  forwardTo: string;
  /** The Gmail label a tag action applies. */
  labelName: string;
  subjectPrefix: string;
  note: string;
  draftInstructions: string;
};

export type ClassificationLabelIntent = {
  name: string;
  /**
   * True for the branch that exists so the classification has somewhere to put
   * everything else. A catch-all takes no actions and no confidence gate — it
   * is where a run is meant to stop.
   */
  isCatchAll: boolean;
  actions: WorkflowActionIntent[];
};

export type WorkflowIntent = {
  name: string;
  classifierPrompt: string;
  labels: ClassificationLabelIntent[];
};

/**
 * How sure the classification has to be before a branch is allowed to act on
 * the mailbox.
 *
 * This is set here rather than by the model: a threshold is a product decision
 * about how much of a mistake the user can tolerate, and it should not drift
 * from one generated workflow to the next. The user can still see it on the
 * wire and change it — that is the point of putting it on the canvas instead of
 * burying it in the prompt.
 */
export const generatedConfidenceThreshold = 0.75;

/** Reads on the wire marker, so the gate explains itself without being opened. */
const confidenceFilterName = "Only when the classification is sure";

/**
 * The name given to the catch-all branch when the model did not think to add
 * one. Deliberately plain: it is a place for mail to stop, not a category.
 */
const defaultCatchAllName = "Other";

/**
 * Actions that reach outside the app — mail leaves the mailbox, a draft appears
 * in it, or a message disappears from the inbox. These are the ones worth
 * gating on confidence; tagging is reversible and internal, so a wrong tag
 * costs the user nothing but a filter click.
 */
const outwardFacingActions = new Set<WorkflowActionType>([
  "forward",
  "draft_reply",
  "archive",
]);

function isOutwardFacing(actions: { type: WorkflowActionType }[]) {
  return actions.some((action) => outwardFacingActions.has(action.type));
}

/**
 * The gate that stops a branch acting on a guess.
 *
 * It reads `{{classification.confidence}}`, which the classification node
 * publishes for exactly this — see `classifierFields` in
 * `src/lib/workflow-variables.ts` and the operator note in
 * `src/lib/workflow-filters.ts`.
 */
function confidenceFilter() {
  return createWorkflowFilter({
    name: confidenceFilterName,
    conditions: [
      createFilterCondition({
        left: variableExpression("classification.confidence"),
        operator: "greater_or_equal",
        right: String(generatedConfidenceThreshold),
      }),
    ],
  });
}

/**
 * The labels a draft can be built from: named, distinct, and with a catch-all
 * at the end.
 *
 * The catch-all is not decoration. A classification's labels are the enum its
 * answer is decoded against (`src/lib/ai/classify-email.ts`), so a workflow
 * offering one label can only ever answer with that label — every email would
 * take the branch, whatever the prompt says. Appending somewhere for "not this"
 * to go is what makes the classification a decision instead of a formality.
 */
function labelIntentsWithCatchAll(labels: ClassificationLabelIntent[]) {
  const seen = new Set<string>();
  const named = labels.filter((label) => {
    const name = label.name.trim().toLowerCase();

    if (!name || seen.has(name)) {
      return false;
    }

    seen.add(name);

    return true;
  });

  // Nothing to catch yet. A lone synthesised catch-all would read as a branch
  // the user had asked for, which is worse than an empty preview.
  if (named.length === 0 || named.some((label) => label.isCatchAll)) {
    return named;
  }

  // A name the model already used cannot be the catch-all as well, so the
  // fallback steps aside rather than colliding with a real branch.
  let name = defaultCatchAllName;
  let attempt = 2;

  while (seen.has(name.toLowerCase())) {
    name = `${defaultCatchAllName} ${attempt}`;
    attempt += 1;
  }

  return [...named, { name, isCatchAll: true, actions: [] }];
}

function buildActions(label: ClassificationLabelIntent) {
  // A catch-all is where a run is meant to end, so anything the model hung off
  // it is dropped rather than run.
  const intents = label.isCatchAll ? [] : label.actions;
  const gated = isOutwardFacing(intents);

  return intents.map((action, index) =>
    createWorkflowAction(action.type, {
      forwardTo: action.forwardTo.trim(),
      labelName: action.labelName.trim(),
      subjectPrefix: action.subjectPrefix.trim(),
      note: action.note.trim(),
      draftInstructions: action.draftInstructions.trim(),
      // The gate goes on the wire into the branch's *first* action, because a
      // filter that blocks ends the run — everything downstream reads "Not
      // reached". Gating the forward alone would still let a tag run on a
      // guess.
      filter: gated && index === 0 ? confidenceFilter() : createWorkflowFilter(),
    })
  );
}

/**
 * Turns what the chat understood into a draft the builder can open.
 *
 * Pure and synchronous, like `buildDebugRun`: it takes an intent and returns a
 * draft, so the same mapping can be previewed in the chat and handed to the
 * canvas without a round trip.
 */
export function buildDraftFromIntent(intent: WorkflowIntent): WorkflowDraft {
  const labels: ClassificationLabel[] = labelIntentsWithCatchAll(
    intent.labels
  ).map((label) =>
    createClassificationLabel({
      name: label.name.trim(),
      actions: buildActions(label),
    })
  );

  return {
    name: intent.name.trim(),
    ownerRole: "",
    trigger: defaultWorkflowTrigger,
    classifierPrompt: intent.classifierPrompt.trim(),
    // The wire from the watcher to the classification runs before there is a
    // classification to ask about, so the chat never puts a rule on it.
    classifierFilter: createWorkflowFilter(),
    labels,
  };
}

/**
 * Whether an intent describes enough of a workflow to open in the builder: a
 * classification that can be run, and at least one branch that does something.
 */
export function isIntentBuildable(intent: WorkflowIntent) {
  if (!intent.classifierPrompt.trim()) {
    return false;
  }

  const named = intent.labels.filter((label) => label.name.trim());

  return (
    named.length > 0 &&
    named.some((label) => !label.isCatchAll && label.actions.length > 0)
  );
}
