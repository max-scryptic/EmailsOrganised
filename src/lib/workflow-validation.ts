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

/**
 * What the debug watcher sends back on each poll: when it started listening,
 * and the messages it has already handed to the board. The seen list is capped
 * because it comes from the browser and is only ever a handful of ids.
 */
export const debugWatchPollSchema = z.object({
  startedAt: z.number().int().positive(),
  seenIds: z.array(z.string().max(128)).max(50),
});

export type DebugWatchPollInput = z.infer<typeof debugWatchPollSchema>;

/**
 * What the board sends to classify the email a test run is stepping through:
 * the prompt, the outputs the model is held to, and the `email.*` values the
 * trigger step produced, so `{{variables}}` resolve to the real message.
 */
export const debugClassifySchema = z.object({
  prompt: z.string().trim().min(1, "Write a classification prompt first."),
  labels: z
    .array(z.string().trim().min(1))
    .min(1, "Name at least one output first."),
  email: z.record(z.string().max(200), z.string()),
});

export type DebugClassifyInput = z.infer<typeof debugClassifySchema>;
