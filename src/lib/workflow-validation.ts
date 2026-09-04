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

export const classificationLabelSchema = z.object({
  id: z.string().min(1),
  // Blank is valid: a label is added before it is named, and a draft is saved
  // as it is built. An unnamed label simply never reaches the model.
  name: z.string(),
  // Same reasoning for a branch whose actions have not been picked yet.
  actions: z.array(workflowActionSchema),
});

export const workflowDraftSchema = z.object({
  // Blank is valid — `saveWorkflow` fills it with the next "New Workflow N".
  name: z.string().trim(),
  ownerRole: z.string(),
  trigger: z.string(),
  classifierPrompt: z.string(),
  labels: z.array(classificationLabelSchema),
});

/**
 * What the builder's "test this classification" button sends. The labels are
 * the answers the model will be held to, so at least one has to be real.
 */
export const classificationTestInputSchema = z.object({
  prompt: z.string().trim().min(1, "Write a classification prompt first."),
  labels: z
    .array(z.string().trim().min(1))
    .min(1, "Add at least one output label first."),
  subject: z.string(),
  body: z.string(),
});

export type ClassificationTestInput = z.infer<
  typeof classificationTestInputSchema
>;

export const saveWorkflowInputSchema = workflowDraftSchema.extend({
  id: workflowIdSchema.optional(),
  status: z.enum(["live", "paused", "draft"]).optional(),
});

export type SaveWorkflowInput = z.infer<typeof saveWorkflowInputSchema>;
