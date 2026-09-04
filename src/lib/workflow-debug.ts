/**
 * The engine behind debug mode: it takes one real email and the draft on the
 * board, and produces the ordered list of steps a run would take through it.
 *
 * Two things are deliberately *not* done here, and the panel says so on its
 * face:
 *
 * - Nothing is written to the mailbox. Actions are resolved and described, not
 *   performed, so testing a workflow can never send, tag, or archive anything.
 * - The classification is a local word match against each classification's own
 *   rule text, not the model that runs live. It exists so the user can see
 *   which branch their words point at and step down any branch they choose.
 *
 * The module is plain TypeScript on purpose: the board runs it in the browser
 * on the unsaved draft, so a workflow can be tested before it is ever saved.
 */

import {
  actionLabels,
  type WorkflowAction,
  type WorkflowDraft,
  type WorkflowOutcome,
} from "@/lib/workflow-data";
import {
  chainNodeOutputTitle,
  chainOutputFields,
  type EmailVariableToken,
  type NodeOutputField,
  type VariableChainNode,
} from "@/lib/workflow-variables";

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
  attachments: string[];
  mailbox: string;
};

export type DebugStepKind = "trigger" | "classifier" | "outcome" | "action";

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

/** How each classification scored against the email, and why. */
export type OutcomeScore = {
  outcomeId: string;
  name: string;
  /** 0 to 1. Zero means nothing in the rule text appears in the email. */
  score: number;
  matched: string[];
  reason: string;
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
  /** Classifier step only: every classification, best match first. */
  scores?: OutcomeScore[];
};

export type DebugRun = {
  email: DebugEmail;
  steps: DebugStep[];
  scores: OutcomeScore[];
  /** The branch the run took, or null when nothing matched. */
  matchedOutcomeId: string | null;
  /** The branch the word match picked, before any override. */
  suggestedOutcomeId: string | null;
  /** True when the user chose the branch instead of the match. */
  forced: boolean;
  /** Why the run stopped where it did, when it stopped early. */
  endNote: string | null;
};

const variablePattern = () => /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Fills `{{tokens}}` from the values earlier steps produced. An unknown token
 * resolves to nothing and is reported, because a field quietly rendering the
 * literal `{{draft.body}}` is the exact bug debug mode exists to surface.
 */
export function resolveTemplate(template: string, values: Map<string, string>) {
  const missing: string[] = [];
  const value = template.replace(variablePattern(), (_full, token: string) => {
    const resolved = values.get(token);

    if (resolved === undefined) {
      missing.push(token);
      return "";
    }

    return resolved;
  });

  return { value, missing };
}

/** Every `email.*` value for one message, one per declared token. */
function emailVariableValues(
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
    "email.attachments.names": email.attachments.join(", "),
    "email.threadId": email.threadId,
    "email.id": email.id,
    "email.mailbox": email.mailbox,
  };
}

/**
 * Words too common to tell one classification from another. Matching on them
 * would make every rule look like a hit.
 */
const stopWords = new Set([
  "the", "and", "for", "you", "your", "our", "with", "that", "this", "from",
  "are", "was", "were", "has", "have", "had", "not", "but", "all", "any",
  "can", "will", "would", "should", "about", "into", "than", "then", "them",
  "they", "there", "here", "when", "what", "which", "who", "whom", "how",
  "email", "emails", "message", "messages", "mail", "sender", "someone",
  "anything", "something", "please", "thanks", "regards", "hello", "http",
  "https", "www", "com",
]);

function significantTerms(text: string) {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3 && !stopWords.has(term))
  );
}

/**
 * Scores one classification against the email by how much of its own rule text
 * turns up in the message. Words in the subject count double — a rule's word in
 * the subject line is a far stronger signal than the same word buried in a
 * quoted thread.
 */
function scoreOutcome(outcome: WorkflowOutcome, email: DebugEmail): OutcomeScore {
  const ruleText = [outcome.name, outcome.description, outcome.examples]
    .filter(Boolean)
    .join(" ");
  const ruleTerms = Array.from(significantTerms(ruleText));

  if (ruleTerms.length === 0) {
    return {
      outcomeId: outcome.id,
      name: outcome.name,
      score: 0,
      matched: [],
      reason:
        "This classification has no rule text yet, so there is nothing to match on.",
    };
  }

  const subjectTerms = significantTerms(email.subject);
  const bodyTerms = significantTerms(
    `${email.snippet} ${email.bodyText} ${email.fromName} ${email.fromAddress}`
  );
  const matchedInSubject: string[] = [];
  const matchedInBody: string[] = [];

  ruleTerms.forEach((term) => {
    if (subjectTerms.has(term)) {
      matchedInSubject.push(term);
      return;
    }

    if (bodyTerms.has(term)) {
      matchedInBody.push(term);
    }
  });

  const weighted = matchedInSubject.length * 2 + matchedInBody.length;
  const score = Math.min(1, weighted / ruleTerms.length);
  const matched = [...matchedInSubject, ...matchedInBody];

  return {
    outcomeId: outcome.id,
    name: outcome.name,
    score,
    matched,
    reason: matchReason(matchedInSubject, matchedInBody),
  };
}

function matchReason(inSubject: string[], inBody: string[]) {
  if (inSubject.length === 0 && inBody.length === 0) {
    return "No word from this classification's rule appears in the email.";
  }

  const parts: string[] = [];

  if (inSubject.length > 0) {
    parts.push(`${listTerms(inSubject)} in the subject`);
  }

  if (inBody.length > 0) {
    parts.push(`${listTerms(inBody)} in the body`);
  }

  return `Matched ${parts.join(", and ")}.`;
}

/** Keeps a reason readable when a rule matches a dozen words. */
function listTerms(terms: string[]) {
  const shown = terms.slice(0, 4).map((term) => `“${term}”`);

  return terms.length > shown.length
    ? `${shown.join(", ")} and ${terms.length - shown.length} more`
    : shown.join(", ");
}

/** Every classification scored against the email, best match first. */
export function scoreOutcomes(draft: WorkflowDraft, email: DebugEmail) {
  return draft.outcomes
    .map((outcome) => scoreOutcome(outcome, email))
    .sort((a, b) => b.score - a.score);
}

/**
 * Builds the run: the steps in the order they happen, with each node's settings
 * resolved against what the steps before it produced.
 *
 * `forcedOutcomeId` follows a branch the word match did not pick, which is how
 * a user tests the branch they are actually working on.
 */
export function buildDebugRun({
  draft,
  email,
  forcedOutcomeId,
}: {
  draft: WorkflowDraft;
  email: DebugEmail;
  forcedOutcomeId?: string | null;
}): DebugRun {
  const scores = scoreOutcomes(draft, email);
  const best = scores.find((score) => score.score > 0) ?? null;
  const suggestedOutcomeId = best?.outcomeId ?? null;
  const forcedOutcome = forcedOutcomeId
    ? draft.outcomes.find((outcome) => outcome.id === forcedOutcomeId) ?? null
    : null;
  const matchedOutcome =
    forcedOutcome ??
    (suggestedOutcomeId
      ? draft.outcomes.find((outcome) => outcome.id === suggestedOutcomeId) ??
        null
      : null);
  const matchedScore = matchedOutcome
    ? scores.find((score) => score.outcomeId === matchedOutcome.id) ?? null
    : null;

  // The nodes this run touches, in order — the same chain the inspector uses to
  // work out which variables a node can read, so the tokens agree.
  const chain: VariableChainNode[] = [
    { id: "trigger", kind: "trigger" },
    { id: "classifier", kind: "classifier" },
  ];

  if (matchedOutcome) {
    chain.push({
      id: matchedOutcome.id,
      kind: "outcome",
      outcomeName: matchedOutcome.name,
    });
    matchedOutcome.actions.forEach((action) => {
      chain.push({ id: action.id, kind: "action", actionType: action.type });
    });
  }

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
    scores: stepScores,
    outputs,
  }: {
    nodeId: string;
    kind: DebugStepKind;
    kindLabel: string;
    title: string;
    summary: string;
    settings: DebugSetting[];
    simulated?: boolean;
    scores?: OutcomeScore[];
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
      scores: stepScores,
    });
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

  const classifierPrompt = resolveTemplate(draft.classifierPrompt, values);

  commit({
    nodeId: "classifier",
    kind: "classifier",
    kindLabel: "Filter",
    title: chainNodeOutputTitle({ id: "classifier", kind: "classifier" }),
    summary: matchedOutcome
      ? `Best match: “${matchedOutcome.name}”${
          forcedOutcome && forcedOutcome.id !== suggestedOutcomeId
            ? " (branch chosen by you)"
            : ""
        }.`
      : draft.outcomes.length === 0
        ? "This workflow has no classifications yet, so there is nothing to match."
        : "No classification matched this email.",
    settings: [
      {
        label: "Filter instructions",
        template: draft.classifierPrompt,
        value: classifierPrompt.value,
        missing: classifierPrompt.missing,
      },
    ],
    scores,
    outputs: {
      name: { value: matchedOutcome?.name ?? "" },
      confidence: { value: matchedScore ? matchedScore.score.toFixed(2) : "0" },
      reasoning: {
        value:
          matchedScore?.reason ??
          (draft.outcomes.length === 0
            ? "There are no classifications to match against yet."
            : "No classification rule matched this email."),
      },
      summary: { value: "", pending: true },
    },
  });

  if (matchedOutcome) {
    const rule = resolveTemplate(matchedOutcome.description, values);
    const examples = resolveTemplate(matchedOutcome.examples, values);

    commit({
      nodeId: matchedOutcome.id,
      kind: "outcome",
      kindLabel: "Classification",
      title: matchedOutcome.name || "Classification",
      summary:
        matchedOutcome.actions.length > 0
          ? `Running ${matchedOutcome.actions.length} action${
              matchedOutcome.actions.length === 1 ? "" : "s"
            } under this classification.`
          : "This classification has no actions attached.",
      settings: [
        {
          label: "Classification rule",
          template: matchedOutcome.description,
          value: rule.value,
          missing: rule.missing,
        },
        {
          label: "Examples",
          template: matchedOutcome.examples,
          value: examples.value,
          missing: examples.missing,
        },
      ],
      outputs: {
        name: { value: matchedOutcome.name },
        rule: { value: rule.value },
      },
    });

    matchedOutcome.actions.forEach((action) => {
      const step = actionStep({ action, values, ranAt });

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
    });
  }

  return {
    email,
    steps,
    scores,
    matchedOutcomeId: matchedOutcome?.id ?? null,
    suggestedOutcomeId,
    forced: Boolean(forcedOutcome && forcedOutcome.id !== suggestedOutcomeId),
    endNote: runEndNote({ draft, matchedOutcome }),
  };
}

function runEndNote({
  draft,
  matchedOutcome,
}: {
  draft: WorkflowDraft;
  matchedOutcome: WorkflowOutcome | null;
}) {
  if (draft.outcomes.length === 0) {
    return "Add a classification and the run will carry on past the filter.";
  }

  if (!matchedOutcome) {
    return "Nothing after the filter ran. Pick a classification on the filter step to test its branch anyway.";
  }

  if (matchedOutcome.actions.length === 0) {
    return "The branch ends here — no actions are attached to this classification.";
  }

  return null;
}

/**
 * What one action would do, described rather than done: its settings resolved
 * against the run so far, plus the values it would publish downstream.
 */
function actionStep({
  action,
  values,
  ranAt,
}: {
  action: WorkflowAction;
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

  if (action.type === "forward") {
    const to = setting("Forward to", action.forwardTo);
    const subjectPrefix = setting("Subject prefix", action.subjectPrefix);

    return {
      summary: to.value
        ? `Would forward the email to ${to.value}.`
        : "Would forward the email, but no address is set.",
      settings: [
        to,
        subjectPrefix,
        setting("Forward note", action.note),
        setting("Signature", action.signature),
        toggle("Include thread", action.includeOriginalThread),
        toggle("Mark handled", action.markHandled),
      ],
      outputs: {
        to: { value: to.value },
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
        ? "Would write a reply and leave it as a draft."
        : "Would write a reply, but no draft instructions are set.",
      settings: [
        tone,
        instructions,
        setting("Signature", action.signature),
        toggle("Require approval", action.requireApproval),
      ],
      outputs: {
        id: { value: "", pending: true },
        subject: { value: "", pending: true },
        body: { value: "", pending: true },
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
    attachments: ["invoice-1024.pdf"],
    mailbox,
  };
}
