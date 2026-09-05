/**
 * The engine behind debug mode: it takes one real email and the draft on the
 * board, and produces the ordered list of steps a run would take through it.
 *
 * One thing is deliberately *not* done here, and the panel says so on its face:
 * nothing is written to the mailbox. Actions are resolved and described, not
 * performed, so testing a workflow can never send, tag, or archive anything.
 *
 * The branch, by contrast, is real. It comes from the same model call the
 * workflow runs on, made on the server before this is called and handed in as
 * `classification` — which is what keeps this module plain synchronous
 * TypeScript that the board can run in the browser on the unsaved draft, so a
 * workflow can be tested before it is ever saved. A run with no answer (no API
 * key, or the call failed) still steps; the user picks the branch instead.
 */

import {
  actionLabels,
  usableClassificationLabels,
  type ClassificationLabel,
  type WorkflowAction,
  type WorkflowDraft,
} from "@/lib/workflow-data";
import {
  evaluateFilter,
  filterLabel,
  isFilterActive,
  type FilterResult,
  type WorkflowFilter,
} from "@/lib/workflow-filters";
import {
  chainNodeOutputTitle,
  chainOutputFields,
  resolveTemplate,
  type EmailVariableToken,
  type NodeOutputField,
  type VariableChainNode,
} from "@/lib/workflow-variables";

/**
 * One file on a message, as the watcher describes it before anybody asks for
 * its bytes.
 *
 * The bytes are deliberately not here. A run is built in the browser and a
 * mailbox attachment can be tens of megabytes, so the watcher carries what it
 * takes to *find* the file — `attachmentId` when Gmail stored the body
 * separately, `partId` when the bytes came inline in the message — and the
 * fetch happens on the server, once, when something actually needs the file.
 */
export type DebugAttachment = {
  /** Gmail's id for the stored body; blank when the bytes came inline. */
  attachmentId: string;
  /** The part's address in the MIME tree, e.g. `"1.2"`. */
  partId: string;
  filename: string;
  mimeType: string;
  /** Size in bytes, as Gmail reports the part. */
  size: number;
  /** True for a file the HTML body references, such as a signature image. */
  inline: boolean;
};

/**
 * One message as the watcher hands it downstream. Every field here backs an
 * `email.*` variable, which is why the shape mirrors the tokens rather than
 * Gmail's own response.
 */
export type DebugEmail = {
  id: string;
  threadId: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  to: string;
  cc: string;
  replyTo: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  /** ISO 8601, as `email.receivedAt` reports it. */
  receivedAt: string;
  labels: string[];
  isUnread: boolean;
  attachments: DebugAttachment[];
  mailbox: string;
};

export type DebugStepKind = "trigger" | "filter" | "classifier" | "action";

/**
 * The model's answer for this email, as the classification node's own call
 * returns it. Null on a run made without one.
 */
export type DebugClassification = {
  label: string;
  confidence: number;
  reasoning: string;
};

/**
 * A setting on the node exactly as the run read it: the text the user typed,
 * and what it came out as once `{{variables}}` were filled in.
 */
export type DebugSetting = {
  label: string;
  template: string;
  value: string;
  /** Tokens in the template that no earlier step produced. */
  missing: string[];
};

/** One value a step handed to the steps after it. */
export type DebugValue = {
  token: string;
  label: string;
  value: string;
  /**
   * Set when only a live run can produce the value — model-written text, or an
   * id Gmail assigns when the action really happens.
   */
  pending?: boolean;
};

/**
 * One of the classification's outputs as the run reports it: whether the model
 * picked it, and whether this run is the one following it. The two differ when
 * the user steps down a branch to test it.
 */
export type DebugBranch = {
  labelId: string;
  name: string;
  /** The model answered with this label. */
  picked: boolean;
  /** This is the branch the run is walking. */
  followed: boolean;
  /** Why this branch cannot be the answer, when it cannot. */
  unusable: string | null;
};

export type DebugStep = {
  /** Stable key for the step; canvas nodes can appear once per run. */
  id: string;
  /** The board node this step is running, so the canvas can follow along. */
  nodeId: string;
  kind: DebugStepKind;
  /** "Trigger", "Filter", "Classification", "Action" — matches the inspector. */
  kindLabel: string;
  title: string;
  /** One line: what this node did with this email. */
  summary: string;
  /** Set on steps that would change the mailbox in a live run. */
  simulated?: boolean;
  settings: DebugSetting[];
  outputs: DebugValue[];
  /** Classification step only: every output, and which one the run follows. */
  branches?: DebugBranch[];
  /** Filter step only: every condition it checked, and the verdict. */
  filter?: FilterResult;
};

/**
 * The step a wire's filter runs as. It is not a node, so it gets an id of its
 * own — namespaced by the node the wire feeds, which is where the filter is
 * stored and which is what the board draws the wire into.
 */
export function filterStepNodeId(targetNodeId: string) {
  return `filter:${targetNodeId}`;
}

export type DebugRun = {
  email: DebugEmail;
  steps: DebugStep[];
  branches: DebugBranch[];
  /** The branch the run took, or null when there is none to take. */
  followedLabelId: string | null;
  /** The branch the model picked, before any override. */
  pickedLabelId: string | null;
  /** True when the user chose the branch instead of following the model. */
  forced: boolean;
  /** Set when the classification could not be run at all. */
  classificationError: string | null;
  /** The filter step that stopped the run, when one did. */
  blockedAtNodeId: string | null;
  /** Why the run stopped where it did, when it stopped early. */
  endNote: string | null;
};

const byteUnits = ["B", "KB", "MB", "GB"];

/**
 * A byte count as a person reads it. Fixed to en-US decimals rather than the
 * viewer's locale, because this string is rendered on the server for the run's
 * summaries and again in the browser for the panel — the two have to match.
 */
export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    byteUnits.length - 1
  );
  const value = bytes / 1024 ** unit;

  // Whole bytes read as bytes; anything scaled keeps one decimal place.
  return `${unit === 0 ? value : value.toFixed(1)} ${byteUnits[unit]}`;
}

/** Every `email.*` value for one message, one per declared token. */
export function emailVariableValues(
  email: DebugEmail
): Record<EmailVariableToken, string> {
  return {
    "email.subject": email.subject,
    "email.from.name": email.fromName,
    "email.from.address": email.fromAddress,
    "email.to": email.to,
    "email.cc": email.cc,
    "email.replyTo": email.replyTo,
    "email.snippet": email.snippet,
    "email.body.text": email.bodyText,
    "email.body.html": email.bodyHtml,
    "email.receivedAt": email.receivedAt,
    "email.labels": email.labels.join(", "),
    "email.isUnread": String(email.isUnread),
    "email.hasAttachments": String(email.attachments.length > 0),
    "email.attachments.count": String(email.attachments.length),
    "email.attachments.names": email.attachments
      .map((attachment) => attachment.filename)
      .join(", "),
    "email.attachments.types": Array.from(
      new Set(email.attachments.map((attachment) => attachment.mimeType))
    ).join(", "),
    "email.attachments.totalSize": formatBytes(
      email.attachments.reduce((total, attachment) => total + attachment.size, 0)
    ),
    "email.threadId": email.threadId,
    "email.id": email.id,
    "email.mailbox": email.mailbox,
  };
}

/**
 * Every output the classification declares, marked with what the run did about
 * it. A blank or repeated name is carried here rather than dropped: the branch
 * is on the board, so the panel has to say why the model was never offered it.
 */
function describeBranches({
  draft,
  pickedLabelId,
  followedLabelId,
}: {
  draft: WorkflowDraft;
  pickedLabelId: string | null;
  followedLabelId: string | null;
}): DebugBranch[] {
  const usableIds = new Set(
    usableClassificationLabels(draft.labels).map((label) => label.id)
  );

  return draft.labels.map((label) => ({
    labelId: label.id,
    name: label.name.trim(),
    picked: label.id === pickedLabelId,
    followed: label.id === followedLabelId,
    unusable: usableIds.has(label.id)
      ? null
      : label.name.trim()
        ? "Another output already has this name, so the model is only offered one of them."
        : "This output has no name yet, so the model is never offered it.",
  }));
}

/**
 * The label the model answered with, as one of the draft's outputs. Matched by
 * name because the name is what the model was given — and it can miss when the
 * board was edited after the call was made.
 */
function labelForAnswer(
  draft: WorkflowDraft,
  classification: DebugClassification | null
) {
  if (!classification) {
    return null;
  }

  return (
    usableClassificationLabels(draft.labels).find(
      (label) => label.name.trim() === classification.label
    ) ?? null
  );
}

/**
 * Builds the run: the steps in the order they happen, with each node's settings
 * resolved against what the steps before it produced.
 *
 * `classification` is the model's answer, already obtained on the server.
 * `forcedLabelId` follows a branch the model did not pick, which is how a user
 * tests the branch they are actually working on.
 */
export function buildDebugRun({
  draft,
  email,
  classification = null,
  classificationError = null,
  forcedLabelId,
}: {
  draft: WorkflowDraft;
  email: DebugEmail;
  classification?: DebugClassification | null;
  classificationError?: string | null;
  forcedLabelId?: string | null;
}): DebugRun {
  const pickedLabel = labelForAnswer(draft, classification);
  const forcedLabel = forcedLabelId
    ? draft.labels.find((label) => label.id === forcedLabelId) ?? null
    : null;
  const followedLabel = forcedLabel ?? pickedLabel;
  const forced = Boolean(forcedLabel && forcedLabel.id !== pickedLabel?.id);
  const branches = describeBranches({
    draft,
    pickedLabelId: pickedLabel?.id ?? null,
    followedLabelId: followedLabel?.id ?? null,
  });

  // The nodes this run touches, in order — the same chain the inspector uses to
  // work out which variables a node can read, so the tokens agree.
  const chain: VariableChainNode[] = [
    { id: "trigger", kind: "trigger" },
    { id: "classifier", kind: "classifier" },
  ];

  followedLabel?.actions.forEach((action) => {
    chain.push({ id: action.id, kind: "action", actionType: action.type });
  });

  const fieldsByNode = chainOutputFields(chain);
  const values = new Map<string, string>();
  const steps: DebugStep[] = [];
  const ranAt = new Date();

  function commit({
    nodeId,
    kind,
    kindLabel,
    title,
    summary,
    settings,
    simulated,
    branches: stepBranches,
    outputs,
  }: {
    nodeId: string;
    kind: DebugStepKind;
    kindLabel: string;
    title: string;
    summary: string;
    settings: DebugSetting[];
    simulated?: boolean;
    branches?: DebugBranch[];
    /** Keyed by the part of the token after its namespace, e.g. `from.name`. */
    outputs: Record<string, { value: string; pending?: boolean }>;
  }) {
    const fields = fieldsByNode.get(nodeId) ?? [];
    const resolved = fields.map((field) =>
      outputValue(field, outputs[fieldSuffix(field.token)])
    );

    resolved.forEach((output) => {
      // A pending value has nothing real behind it, so a later field reading it
      // is reported as unresolved rather than filled with a placeholder.
      if (!output.pending) {
        values.set(output.token, output.value);
      }
    });

    steps.push({
      id: `${nodeId}-${kind}`,
      nodeId,
      kind,
      kindLabel,
      title,
      summary,
      simulated,
      settings,
      outputs: resolved,
      branches: stepBranches,
    });
  }

  /**
   * Runs the filter on the wire into `targetNodeId`, if it has one. Returns
   * false when the email was stopped there, which is the caller's cue to end
   * the run — a blocked wire is not a failure, it is the wire doing its job.
   */
  function passesWire(targetNodeId: string, filter: WorkflowFilter) {
    if (!isFilterActive(filter)) {
      return true;
    }

    const result = evaluateFilter(filter, values);

    steps.push({
      id: `${targetNodeId}-filter`,
      nodeId: filterStepNodeId(targetNodeId),
      kind: "filter",
      kindLabel: "Filter",
      title: filterLabel(filter),
      summary: filterSummaryForRun(result),
      settings: [],
      outputs: [],
      filter: result,
    });

    return result.passed;
  }

  commit({
    nodeId: "trigger",
    kind: "trigger",
    kindLabel: "Trigger",
    title: chainNodeOutputTitle({ id: "trigger", kind: "trigger" }),
    summary: `Picked up “${email.subject || "(no subject)"}” from ${
      email.fromName || email.fromAddress || "an unknown sender"
    }.`,
    settings: [
      {
        label: "Trigger",
        template: draft.trigger,
        value: draft.trigger,
        missing: [],
      },
    ],
    outputs: mapValues(emailVariableValues(email), (value) => ({ value })),
  });

  // The wires are checked in the order the email travels them, and the first
  // one that blocks ends the run — everything past it is a node this email
  // never reaches.
  let blockedAtNodeId: string | null = null;

  if (!passesWire("classifier", draft.classifierFilter)) {
    blockedAtNodeId = filterStepNodeId("classifier");
  }

  if (!blockedAtNodeId) {
    const prompt = resolveTemplate(draft.classifierPrompt, values);

    commit({
      nodeId: "classifier",
      kind: "classifier",
      kindLabel: "Classification",
      title: chainNodeOutputTitle({ id: "classifier", kind: "classifier" }),
      summary: classificationSummary({
        draft,
        classification,
        classificationError,
        pickedLabel,
        followedLabel,
        forced,
      }),
      settings: [
        {
          label: "Prompt",
          template: draft.classifierPrompt,
          value: prompt.value,
          missing: prompt.missing,
        },
        {
          label: "Outputs",
          template: outputsSetting(draft),
          value: outputsSetting(draft),
          missing: [],
        },
      ],
      branches,
      outputs: {
        label: { value: classification?.label ?? "" },
        confidence: {
          value: classification ? classification.confidence.toFixed(2) : "",
          pending: !classification,
        },
        reasoning: {
          value: classification?.reasoning ?? "",
          pending: !classification,
        },
      },
    });

    for (const action of followedLabel?.actions ?? []) {
      if (!passesWire(action.id, action.filter)) {
        blockedAtNodeId = filterStepNodeId(action.id);
        break;
      }

      const step = actionStep({ action, email, values, ranAt });

      commit({
        nodeId: action.id,
        kind: "action",
        kindLabel: "Action",
        title: actionLabels[action.type],
        summary: step.summary,
        simulated: true,
        settings: step.settings,
        outputs: step.outputs,
      });
    }
  }

  return {
    email,
    steps,
    branches,
    followedLabelId: followedLabel?.id ?? null,
    pickedLabelId: pickedLabel?.id ?? null,
    forced,
    classificationError,
    blockedAtNodeId,
    endNote: runEndNote({
      draft,
      followedLabel,
      classificationError,
      blockedStep: blockedAtNodeId
        ? steps.find((step) => step.nodeId === blockedAtNodeId) ?? null
        : null,
    }),
  };
}

/** What a filter step says it did, in one line. */
function filterSummaryForRun(result: FilterResult) {
  if (result.passed) {
    if (result.conditions.length === 1) {
      return "The email met this condition, so it carries on.";
    }

    return result.match === "all"
      ? "The email met every condition, so it carries on."
      : "The email met at least one condition, so it carries on.";
  }

  const failed = result.conditions.filter((condition) => !condition.passed);

  return result.match === "all"
    ? `The email stops here: ${countLabel(failed.length, "condition")} did not hold.`
    : "The email stops here: none of these conditions held.";
}

/** The outputs exactly as the model was offered them, one per line. */
function outputsSetting(draft: WorkflowDraft) {
  const usable = usableClassificationLabels(draft.labels);

  return usable.length > 0
    ? usable.map((label) => label.name.trim()).join("\n")
    : "";
}

function classificationSummary({
  draft,
  classification,
  classificationError,
  pickedLabel,
  followedLabel,
  forced,
}: {
  draft: WorkflowDraft;
  classification: DebugClassification | null;
  classificationError: string | null;
  pickedLabel: ClassificationLabel | null;
  followedLabel: ClassificationLabel | null;
  forced: boolean;
}) {
  if (usableClassificationLabels(draft.labels).length === 0) {
    return "This classification has no named outputs yet, so there is nothing the model can answer with.";
  }

  if (classificationError) {
    return forced && followedLabel
      ? `The model could not be asked, so this run follows “${followedLabel.name.trim()}” because you picked it.`
      : "The model could not be asked. Pick an output below to step down its branch anyway.";
  }

  if (!classification) {
    return followedLabel
      ? `Following “${followedLabel.name.trim()}” because you picked it.`
      : "Pick an output below to step down its branch.";
  }

  const confidence = `${Math.round(classification.confidence * 100)}% confident`;

  if (forced && followedLabel) {
    return `The model answered “${classification.label}” (${confidence}); this run follows “${followedLabel.name.trim()}” because you picked it.`;
  }

  if (!pickedLabel) {
    // The answer no longer names an output — the board was edited after the
    // call, which is worth saying rather than showing an empty branch.
    return `The model answered “${classification.label}”, which is no longer one of this classification's outputs.`;
  }

  return `The model answered “${classification.label}” — ${confidence}.`;
}

function runEndNote({
  draft,
  followedLabel,
  classificationError,
  blockedStep,
}: {
  draft: WorkflowDraft;
  followedLabel: ClassificationLabel | null;
  classificationError: string | null;
  /** The filter step that stopped the run, when one did. */
  blockedStep: DebugStep | null;
}) {
  // A blocked wire is the whole story of where the run ended, and it outranks
  // anything the classification might otherwise have had to say.
  if (blockedStep) {
    return `The “${blockedStep.title}” filter blocked this email, so nothing after that wire ran.`;
  }

  if (usableClassificationLabels(draft.labels).length === 0) {
    return "Name an output on the classification and the run will carry on past it.";
  }

  if (!followedLabel) {
    return classificationError
      ? "Nothing after the classification ran. Pick an output on this step to test its branch anyway."
      : "Nothing after the classification ran. Pick an output on this step to test its branch.";
  }

  if (followedLabel.actions.length === 0) {
    return "The branch ends here — no actions are attached to this output.";
  }

  return null;
}

/**
 * What one action would do, described rather than done: its settings resolved
 * against the run so far, plus the values it would publish downstream.
 */
function actionStep({
  action,
  email,
  values,
  ranAt,
}: {
  action: WorkflowAction;
  /** The message being stepped through, for the files it carries. */
  email: DebugEmail;
  values: Map<string, string>;
  ranAt: Date;
}): {
  summary: string;
  settings: DebugSetting[];
  outputs: Record<string, { value: string; pending?: boolean }>;
} {
  const at = ranAt.toISOString();
  const setting = (label: string, template: string): DebugSetting => {
    const resolved = resolveTemplate(template, values);

    return {
      label,
      template,
      value: resolved.value,
      missing: resolved.missing,
    };
  };
  const toggle = (label: string, checked: boolean): DebugSetting => ({
    label,
    template: checked ? "On" : "Off",
    value: checked ? "On" : "Off",
    missing: [],
  });

  const carried = carriedAttachments(action, email);

  if (action.type === "forward") {
    const to = setting("Forward to", action.forwardTo);
    const subjectPrefix = setting("Subject prefix", action.subjectPrefix);

    return {
      summary: to.value
        ? `Would forward the email to ${to.value}${carried.clause}.`
        : "Would forward the email, but no address is set.",
      settings: [
        to,
        subjectPrefix,
        setting("Forward note", action.note),
        setting("Signature", action.signature),
        toggle("Include thread", action.includeOriginalThread),
        carried.setting,
        toggle("Mark handled", action.markHandled),
      ],
      outputs: {
        to: { value: to.value },
        attachments: { value: carried.names },
        messageId: { value: "", pending: true },
        sentAt: { value: at },
      },
    };
  }

  if (action.type === "draft_reply") {
    const tone = setting("Tone", action.draftTone);
    const instructions = setting("Draft instructions", action.draftInstructions);

    return {
      summary: instructions.value
        ? `Would write a reply and leave it as a draft${carried.clause}.`
        : "Would write a reply, but no draft instructions are set.",
      settings: [
        tone,
        instructions,
        setting("Signature", action.signature),
        carried.setting,
        toggle("Require approval", action.requireApproval),
      ],
      outputs: {
        id: { value: "", pending: true },
        subject: { value: "", pending: true },
        body: { value: "", pending: true },
        attachments: { value: carried.names },
        status: {
          value: action.requireApproval ? "awaiting_approval" : "ready",
        },
      },
    };
  }

  if (action.type === "apply_label") {
    const label = setting("Tag", action.labelName);

    return {
      summary: label.value
        ? `Would tag the email “${label.value}”.`
        : "Would tag the email, but no tag is set.",
      settings: [label, setting("Note", action.note)],
      outputs: {
        name: { value: label.value },
        appliedAt: { value: at },
      },
    };
  }

  return {
    summary: "Would archive the email out of the inbox.",
    settings: [
      setting("Archive note", action.note),
      toggle("Mark handled", action.markHandled),
    ],
    outputs: {
      archivedAt: { value: at },
    },
  };
}

/**
 * The files an action would take with it, for the actions that can carry one.
 *
 * "Would carry" is the whole answer here: a test run never fetches the bytes,
 * because it never sends anything to put them in. What it reports is which
 * files a live run would pull — the same list a live send would ask
 * `fetchAttachmentBytes` for, one file at a time.
 */
function carriedAttachments(action: WorkflowAction, email: DebugEmail) {
  const off = { setting: attachmentSetting("Off"), names: "", clause: "" };

  if (!action.includeAttachments) {
    return off;
  }

  if (email.attachments.length === 0) {
    return {
      setting: attachmentSetting("On — this email has none"),
      names: "",
      clause: "",
    };
  }

  const total = email.attachments.reduce(
    (bytes, attachment) => bytes + attachment.size,
    0
  );
  const names = email.attachments
    .map((attachment) => attachment.filename)
    .join(", ");

  return {
    setting: attachmentSetting(`${names} (${formatBytes(total)})`),
    names,
    clause: `, with ${countLabel(email.attachments.length, "attachment")}`,
  };
}

function attachmentSetting(value: string): DebugSetting {
  return { label: "Attachments", template: value, value, missing: [] };
}

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** `forward.messageId` → `messageId`; `email.from.name` → `from.name`. */
function fieldSuffix(token: string) {
  const dot = token.indexOf(".");

  return dot === -1 ? token : token.slice(dot + 1);
}

function outputValue(
  field: NodeOutputField,
  produced: { value: string; pending?: boolean } | undefined
): DebugValue {
  return {
    token: field.token,
    label: field.label,
    value: produced?.value ?? "",
    // A field the step declares but did not fill can only be a live-run value.
    pending: produced ? produced.pending : true,
  };
}

function mapValues<T, R>(
  source: Record<string, T>,
  transform: (value: T) => R
): Record<string, R> {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      fieldSuffix(key),
      transform(value),
    ])
  );
}

/**
 * The email debug mode falls back to when there is no mailbox to listen to —
 * on a clean checkout, or before Google consent. Its values are the same ones
 * the variable panel shows as examples, so the two surfaces agree.
 */
export function sampleDebugEmail(
  mailbox = "you@yourcompany.com"
): DebugEmail {
  return {
    id: "18f0a2c4b5d6e7ff",
    threadId: "18f0a2c4b5d6e7f8",
    subject: "Re: Invoice 1024 is overdue",
    fromName: "Ada Lovelace",
    fromAddress: "ada@example.com",
    to: "billing@yourcompany.com",
    cc: "finance@yourcompany.com",
    replyTo: "ada+billing@example.com",
    snippet:
      "Just checking in on invoice 1024 — it was due last Friday and I have not seen the payment land yet.",
    bodyText:
      "Hi there,\n\nJust checking in on invoice 1024 — it was due last Friday " +
      "and I have not seen the payment land yet. Could you confirm when it " +
      "went out?\n\nThanks,\nAda",
    bodyHtml:
      "<p>Hi there,</p><p>Just checking in on invoice 1024 — it was due last " +
      "Friday and I have not seen the payment land yet.</p><p>Thanks,<br>Ada</p>",
    receivedAt: new Date().toISOString(),
    labels: ["INBOX", "IMPORTANT"],
    isUnread: true,
    attachments: [
      {
        // No ids: the sample email is not in anybody's mailbox, so there is
        // nothing to fetch and the panel says so rather than offering a button
        // that could only fail.
        attachmentId: "",
        partId: "",
        filename: "invoice-1024.pdf",
        mimeType: "application/pdf",
        size: 184_320,
        inline: false,
      },
    ],
    mailbox,
  };
}
