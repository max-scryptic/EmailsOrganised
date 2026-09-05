import { actionLabels, type WorkflowActionType } from "@/lib/workflow-data";

/**
 * One value a node hands to the nodes after it. `token` is what gets typed into
 * a text field — the builder inserts it wrapped in `{{ }}` — and `example` is
 * what that value looked like for a real email, so the field reads as something
 * concrete rather than a name.
 */
export type NodeOutputField = {
  token: string;
  label: string;
  description: string;
  example: string;
};

/** The nodes a variable can come from, described by what they output. */
export type VariableChainNode =
  | { id: string; kind: "trigger" }
  | { id: string; kind: "classifier" }
  | { id: string; kind: "action"; actionType: WorkflowActionType };

/** A node's outputs as the inspector groups them: one card per source node. */
export type NodeOutputGroup = {
  nodeId: string;
  /** What the node is called on the board, e.g. "Email watcher". */
  title: string;
  /** The node's kind, e.g. "Trigger", so two classifications stay apart. */
  kindLabel: string;
  fields: NodeOutputField[];
};

export const variableOpen = "{{";
export const variableClose = "}}";

/** Wraps a token the way a text field stores it. */
export function variableExpression(token: string) {
  return `${variableOpen}${token}${variableClose}`;
}

/**
 * Everything the mailbox watcher pulls back for a message. These mirror the
 * fields of a Gmail `users.messages.get` response — the watcher retrieves the
 * message, and every one of these values travels down the workflow with it.
 */
const emailFields = [
  {
    token: "email.subject",
    label: "Subject",
    description: "Subject line of the message.",
    example: "Re: Invoice 1024 is overdue",
  },
  {
    token: "email.from.name",
    label: "From name",
    description: "Display name on the sender's address.",
    example: "Ada Lovelace",
  },
  {
    token: "email.from.address",
    label: "From address",
    description: "Email address the message was sent from.",
    example: "ada@example.com",
  },
  {
    token: "email.to",
    label: "To",
    description: "Every address in the To header, comma separated.",
    example: "billing@yourcompany.com",
  },
  {
    token: "email.cc",
    label: "Cc",
    description: "Every address in the Cc header, comma separated.",
    example: "finance@yourcompany.com",
  },
  {
    token: "email.replyTo",
    label: "Reply-to",
    description: "Where a reply is addressed when it differs from the sender.",
    example: "ada+billing@example.com",
  },
  {
    token: "email.snippet",
    label: "Snippet",
    description: "The short preview Gmail returns with the message.",
    example: "Just checking in on invoice 1024 — it was due last Friday…",
  },
  {
    token: "email.body.text",
    label: "Body (text)",
    description: "Full plain-text body of the message.",
    example: "Hi there,\n\nJust checking in on invoice 1024…",
  },
  {
    token: "email.body.html",
    label: "Body (HTML)",
    description: "Full HTML body, when the message has one.",
    example: "<p>Hi there,</p><p>Just checking in…</p>",
  },
  {
    token: "email.receivedAt",
    label: "Received at",
    description: "When the message arrived in the mailbox.",
    example: "2026-09-04T09:12:44Z",
  },
  {
    token: "email.labels",
    label: "Labels",
    description: "Gmail labels already on the message, comma separated.",
    example: "INBOX, IMPORTANT",
  },
  {
    token: "email.isUnread",
    label: "Unread",
    description: "Whether the message is still unread.",
    example: "true",
  },
  // Attachments describe the files; they never carry them. A variable is text
  // that gets typed into a field, so the bytes stay behind an explicit fetch —
  // `fetchAttachmentBytes` in `src/lib/gmail/messages.ts` — and an action takes
  // the file itself by being told to, not by interpolating it.
  {
    token: "email.hasAttachments",
    label: "Has attachments",
    description: "Whether the message carries any attachment.",
    example: "true",
  },
  {
    token: "email.attachments.count",
    label: "Attachment count",
    description: "How many attachments the message carries.",
    example: "2",
  },
  {
    token: "email.attachments.names",
    label: "Attachment names",
    description: "File names of the attachments, comma separated.",
    example: "invoice-1024.pdf, terms.pdf",
  },
  {
    token: "email.attachments.types",
    label: "Attachment types",
    description: "The content types the attachments are, comma separated.",
    example: "application/pdf",
  },
  {
    token: "email.attachments.totalSize",
    label: "Attachment size",
    description: "How much the attachments weigh together.",
    example: "1.4 MB",
  },
  {
    token: "email.threadId",
    label: "Thread ID",
    description: "Gmail thread the message belongs to.",
    example: "18f0a2c4b5d6e7f8",
  },
  {
    token: "email.id",
    label: "Message ID",
    description: "Gmail's id for this message.",
    example: "18f0a2c4b5d6e7ff",
  },
  {
    token: "email.mailbox",
    label: "Mailbox",
    description: "The connected account the message arrived in.",
    example: "you@yourcompany.com",
  },
] as const satisfies readonly NodeOutputField[];

/**
 * The tokens the watcher publishes, as a union. A debug run fills one value per
 * token, so typing the record against this makes a missed field a type error
 * rather than a blank row in the panel.
 */
export type EmailVariableToken = (typeof emailFields)[number]["token"];

/**
 * What the classification step decides about a message. These are exactly the
 * three values the model is forced to return, which is why there is nothing
 * here the run cannot actually produce.
 */
const classifierFields: NodeOutputField[] = [
  {
    token: "classification.label",
    label: "Label",
    description: "The output label the model picked for this email.",
    example: "Sales",
  },
  {
    token: "classification.confidence",
    label: "Confidence",
    description: "How sure the model was, from 0 to 1.",
    example: "0.92",
  },
  {
    token: "classification.reasoning",
    label: "Reasoning",
    description: "The model's short explanation for the label it picked.",
    example: "Mentions invoice 1024 and a missed due date.",
  },
];

/**
 * The prefix an action's outputs sit under. Kept short because it is typed by
 * hand as often as it is clicked.
 */
const actionNamespaces = {
  forward: "forward",
  draft_reply: "draft",
  apply_label: "label",
  archive: "archive",
} satisfies Record<WorkflowActionType, string>;

function actionFields(
  type: WorkflowActionType,
  namespace: string
): NodeOutputField[] {
  if (type === "forward") {
    return [
      {
        token: `${namespace}.to`,
        label: "Forwarded to",
        description: "Address the email was forwarded to.",
        example: "collections@yourcompany.com",
      },
      {
        token: `${namespace}.attachments`,
        label: "Forwarded attachments",
        description: "File names the forward carried, when it carried any.",
        example: "invoice-1024.pdf",
      },
      {
        token: `${namespace}.messageId`,
        label: "Forwarded message ID",
        description: "Gmail id of the message that was sent on.",
        example: "18f0a2c4b5d70011",
      },
      {
        token: `${namespace}.sentAt`,
        label: "Sent at",
        description: "When the forward went out.",
        example: "2026-09-04T09:12:59Z",
      },
    ];
  }

  if (type === "draft_reply") {
    return [
      {
        token: `${namespace}.id`,
        label: "Draft ID",
        description: "Gmail id of the draft that was created.",
        example: "r-483920184920",
      },
      {
        token: `${namespace}.subject`,
        label: "Draft subject",
        description: "Subject line the draft was written with.",
        example: "Re: Invoice 1024 is overdue",
      },
      {
        token: `${namespace}.body`,
        label: "Draft body",
        description: "The reply the model wrote.",
        example: "Hi Ada,\n\nThanks for the nudge — payment went out…",
      },
      {
        token: `${namespace}.attachments`,
        label: "Draft attachments",
        description: "File names the draft carried, when it carried any.",
        example: "invoice-1024.pdf",
      },
      {
        token: `${namespace}.status`,
        label: "Draft status",
        description: "Whether the draft is waiting for approval or ready.",
        example: "awaiting_approval",
      },
    ];
  }

  if (type === "apply_label") {
    return [
      {
        token: `${namespace}.name`,
        label: "Tag applied",
        description: "The tag that was put on the email.",
        example: "Billing/Overdue",
      },
      {
        token: `${namespace}.appliedAt`,
        label: "Applied at",
        description: "When the tag was applied.",
        example: "2026-09-04T09:12:51Z",
      },
    ];
  }

  return [
    {
      token: `${namespace}.archivedAt`,
      label: "Archived at",
      description: "When the email left the inbox.",
      example: "2026-09-04T09:13:02Z",
    },
  ];
}

/**
 * The outputs of every node in one chain, keyed by node id.
 *
 * Two actions of the same type in the same chain would otherwise publish the
 * same tokens, so the second one on is numbered — `draft`, then `draft2`. The
 * numbering follows the chain, which is also the order the nodes run in.
 */
export function chainOutputFields(chain: VariableChainNode[]) {
  const fieldsByNode = new Map<string, NodeOutputField[]>();
  const namespaceCounts = new Map<string, number>();

  chain.forEach((node) => {
    if (node.kind === "trigger") {
      fieldsByNode.set(node.id, [...emailFields]);
      return;
    }

    if (node.kind === "classifier") {
      fieldsByNode.set(node.id, classifierFields);
      return;
    }

    const base = actionNamespaces[node.actionType];
    const seen = (namespaceCounts.get(base) ?? 0) + 1;

    namespaceCounts.set(base, seen);
    fieldsByNode.set(
      node.id,
      actionFields(node.actionType, seen === 1 ? base : `${base}${seen}`)
    );
  });

  return fieldsByNode;
}

/** The label an action's variable group carries, e.g. "Draft reply". */
export function chainNodeOutputTitle(node: VariableChainNode) {
  if (node.kind === "trigger") {
    return "Email watcher";
  }

  if (node.kind === "classifier") {
    return "Classification";
  }

  return actionLabels[node.actionType];
}

/**
 * Puts `expression` where the caret is, replacing whatever was selected. The
 * returned caret sits after the inserted text so typing carries on from there.
 */
export function insertAtSelection({
  value,
  expression,
  selectionStart,
  selectionEnd,
}: {
  value: string;
  expression: string;
  selectionStart: number;
  selectionEnd: number;
}) {
  const start = Math.min(Math.max(selectionStart, 0), value.length);
  const end = Math.min(Math.max(selectionEnd, start), value.length);

  return {
    value: `${value.slice(0, start)}${expression}${value.slice(end)}`,
    caret: start + expression.length,
  };
}

const variablePattern = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Every `{{token}}` in a field, in the order it appears. */
export function usedVariableTokens(value: string) {
  return Array.from(value.matchAll(variablePattern)).map((match) => match[1]);
}

/**
 * Swaps every `{{token}}` this run has a value for. A token with no value is
 * left as it was written rather than blanked, so a prompt sent to the model
 * still reads as the user wrote it instead of quietly losing a clause.
 */
export function applyVariables(text: string, values: Record<string, string>) {
  return text.replace(variablePattern, (match, token: string) =>
    token in values ? values[token] : match
  );
}

/**
 * The `{{email.*}}` values a test run stands in with: whatever the tester
 * typed, and the documented example for every field they did not.
 */
export function sampleEmailValues(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {};

  emailFields.forEach((field) => {
    values[field.token] = field.example;
  });

  return { ...values, ...overrides };
}
