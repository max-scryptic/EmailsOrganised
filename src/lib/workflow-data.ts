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

export const actionLabels: Record<WorkflowActionType, string> = {
  forward: "Forward email",
  draft_reply: "Draft reply",
  apply_label: "Apply label",
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
    "Classify each email by urgency, relationship, and whether it needs the CEO personally.",
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
