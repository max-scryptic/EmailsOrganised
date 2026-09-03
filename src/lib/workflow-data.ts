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
  ownerRole: string;
  trigger: string;
  classifierPrompt: string;
  outcomes: WorkflowOutcome[];
};

export type WorkflowStatus = "live" | "paused" | "draft";

/**
 * A workflow as it appears in the workflows list. `detail` is the one-line
 * summary the table shows next to the name; `draft` is what the builder edits
 * on the detail page.
 */
export type SavedWorkflow = {
  id: string;
  status: WorkflowStatus;
  detail: string;
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

export const ceoWorkflowDraft: WorkflowDraft = {
  name: "CEO inbox triage",
  ownerRole: "CEO",
  trigger: "Email arrives in primary inbox",
  classifierPrompt:
    "Filter each email by urgency, relationship, and whether it needs the CEO personally.",
  outcomes: [
    {
      id: "investor",
      name: "Investor or board",
      description:
        "Board updates, investor requests, financing notes, and governance threads.",
      examples:
        "Board packet feedback for Friday\nInvestor asking for latest ARR and burn\nFollow-up from financing counsel",
      actions: [
        createWorkflowAction("forward", {
          id: "action-investor-forward",
          forwardTo: "chief-of-staff@example.com",
          subjectPrefix: "[Investor]",
          note: "Please prep context and suggested response before end of day.",
          signature: "Max\nCEO, EmailsOrganised",
        }),
      ],
    },
    {
      id: "finance",
      name: "Finance",
      description:
        "Invoices, receipts, payment questions, tax documents, budgets, and vendor finance messages.",
      examples:
        "Invoice from cloud vendor\nReceipt for team travel\nCustomer asks for W-9 or payment details",
      actions: [
        createWorkflowAction("apply_label", {
          id: "action-finance-label",
          labelName: "Finance",
        }),
        createWorkflowAction("forward", {
          id: "action-finance-forward",
          forwardTo: "finance@example.com",
          subjectPrefix: "[Finance]",
          note: "Please process this finance email and tell me only if approval is needed.",
          signature: "Max\nCEO, EmailsOrganised",
          markHandled: true,
        }),
      ],
    },
    {
      id: "potential-client",
      name: "Potential client",
      description:
        "New sales interest, partnership enquiries, referrals, and buyer questions that need a warm first response.",
      examples:
        "Founder asks for pricing after a referral\nOperations lead wants a demo\nPotential client describes inbox triage problem",
      actions: [
        createWorkflowAction("draft_reply", {
          id: "action-client-draft",
          draftInstructions:
            "Thank them for reaching out, acknowledge their context, suggest a short intro call, and ask for two suitable times.",
          draftTone: "Warm, direct, founder-led",
          signature: "Max\nCEO, EmailsOrganised",
        }),
      ],
    },
    {
      id: "customer-escalation",
      name: "Customer escalation",
      description:
        "Enterprise customer complaints, renewal risk, outage reports, or urgent success issues.",
      examples:
        "Procurement says renewal is blocked\nVP at customer reports failed rollout\nEscalation from support lead",
      actions: [
        createWorkflowAction("forward", {
          id: "action-escalation-forward",
          forwardTo: "success-leads@example.com",
          subjectPrefix: "[Escalation]",
          note: "Please own the response plan and keep me copied on the first reply.",
          signature: "Max\nCEO, EmailsOrganised",
          markHandled: true,
        }),
      ],
    },
  ],
};

export const supportTriageDraft: WorkflowDraft = {
  name: "Support inbox triage",
  ownerRole: "Support lead",
  trigger: "Email arrives in support@ shared mailbox",
  classifierPrompt:
    "Sort each support email by whether it is a bug, a how-to question, or a billing issue, and flag anything that mentions an outage.",
  outcomes: [
    {
      id: "bug-report",
      name: "Bug report",
      description:
        "Reproducible defects, error messages, and broken integrations reported by customers.",
      examples:
        "Sync stopped after the latest release\nLabels are applied twice on forwarded mail\nCustomer pasted a stack trace",
      actions: [
        createWorkflowAction("apply_label", {
          id: "action-support-bug-label",
          labelName: "Bug",
        }),
        createWorkflowAction("forward", {
          id: "action-support-bug-forward",
          forwardTo: "engineering@example.com",
          subjectPrefix: "[Bug]",
          note: "Please confirm whether this reproduces before we reply to the customer.",
          signature: "Support, EmailsOrganised",
        }),
      ],
    },
    {
      id: "how-to",
      name: "How-to question",
      description:
        "Setup questions and usage guidance that a documented answer already covers.",
      examples:
        "How do I connect a second mailbox?\nWhere do I change the classifier prompt?\nCan I export my workflow?",
      actions: [
        createWorkflowAction("draft_reply", {
          id: "action-support-howto-draft",
          draftInstructions:
            "Answer the question directly, link the relevant docs page, and offer a short call if they are still stuck.",
          draftTone: "Friendly and practical",
          signature: "Support, EmailsOrganised",
        }),
      ],
    },
    {
      id: "billing-question",
      name: "Billing question",
      description:
        "Plan changes, invoices, refunds, and anything that needs the billing owner.",
      examples:
        "Please move us to the annual plan\nWe need a copy of last month's invoice\nCard was declined",
      actions: [
        createWorkflowAction("forward", {
          id: "action-support-billing-forward",
          forwardTo: "billing@example.com",
          subjectPrefix: "[Billing]",
          note: "Please handle directly and close the loop with the customer.",
          signature: "Support, EmailsOrganised",
          markHandled: true,
        }),
      ],
    },
  ],
};

export const newsletterCleanupDraft: WorkflowDraft = {
  name: "Newsletter cleanup",
  ownerRole: "Everyone",
  trigger: "Email arrives in primary inbox",
  classifierPrompt:
    "Identify bulk mail — newsletters, product announcements, and marketing sequences — and keep only what the reader has said they follow.",
  outcomes: [
    {
      id: "followed-newsletter",
      name: "Followed newsletter",
      description:
        "Publications the reader deliberately subscribed to and still wants in the inbox.",
      examples:
        "Weekly industry digest\nEngineering blog roundup\nA newsletter the reader replied to before",
      actions: [
        createWorkflowAction("apply_label", {
          id: "action-newsletter-keep-label",
          labelName: "Reading",
        }),
      ],
    },
    {
      id: "bulk-marketing",
      name: "Bulk marketing",
      description:
        "Vendor promotions, drip campaigns, and announcements that never need a reply.",
      examples:
        "Limited time discount on a tool we don't use\nWebinar invitation from a vendor\nProduct launch blast",
      actions: [
        createWorkflowAction("apply_label", {
          id: "action-newsletter-bulk-label",
          labelName: "Bulk",
        }),
        createWorkflowAction("archive", {
          id: "action-newsletter-bulk-archive",
          markHandled: true,
        }),
      ],
    },
  ],
};

/**
 * Placeholder until workflows are persisted — same status as the sample data in
 * `template-data.ts`.
 */
export const savedWorkflows: SavedWorkflow[] = [
  {
    id: "ceo-inbox-triage",
    status: "live",
    detail:
      "Routes investor, finance, sales, and escalation mail out of the CEO inbox before it needs a read.",
    updatedAt: "2026-08-28",
    draft: ceoWorkflowDraft,
  },
  {
    id: "support-inbox-triage",
    status: "live",
    detail:
      "Splits the shared support mailbox into bugs, how-to questions, and billing, and drafts the easy replies.",
    updatedAt: "2026-08-21",
    draft: supportTriageDraft,
  },
  {
    id: "newsletter-cleanup",
    status: "draft",
    detail:
      "Keeps followed newsletters in the inbox and archives the rest of the bulk mail.",
    updatedAt: "2026-08-14",
    draft: newsletterCleanupDraft,
  },
];

export function getSavedWorkflow(id: string): SavedWorkflow | undefined {
  return savedWorkflows.find((workflow) => workflow.id === id);
}
