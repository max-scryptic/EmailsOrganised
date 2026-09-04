import { z } from "zod";

const workflowActionTypeSchema = z.enum([
  "forward",
  "draft_reply",
  "apply_label",
  "archive",
]);

export const workflowIdSchema = z.uuid();

export const workflowActionSchema = z.object({
  id: z.string().min(1),
  type: workflowActionTypeSchema,
  labelName: z.string(),
  forwardTo: z.string(),
  subjectPrefix: z.string(),
  note: z.string(),
  signature: z.string(),
  includeOriginalThread: z.boolean(),
  markHandled: z.boolean(),
  draftInstructions: z.string(),
  draftTone: z.string(),
  requireApproval: z.boolean(),
});

export const workflowOutcomeSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  examples: z.string(),
  actions: z.array(workflowActionSchema).min(1),
});

export const workflowDraftSchema = z.object({
  // Blank is valid — `saveWorkflow` fills it with the next "New Workflow N".
  name: z.string().trim(),
  ownerRole: z.string(),
  trigger: z.string(),
  classifierPrompt: z.string(),
  outcomes: z.array(workflowOutcomeSchema),
});

export const saveWorkflowInputSchema = workflowDraftSchema.extend({
  id: workflowIdSchema.optional(),
  status: z.enum(["live", "paused", "draft"]).optional(),
});

export type SaveWorkflowInput = z.infer<typeof saveWorkflowInputSchema>;
