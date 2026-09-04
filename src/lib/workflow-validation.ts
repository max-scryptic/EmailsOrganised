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
  // A draft is saved as it is built, so a classification whose actions have not
  // been picked yet is valid to store.
  actions: z.array(workflowActionSchema),
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
