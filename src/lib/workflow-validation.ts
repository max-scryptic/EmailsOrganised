import { z } from "zod";

import { chatMessageMaxLength } from "@/lib/workflow-chat-examples";
import {
  createWorkflowFilter,
  filterOperatorNames,
} from "@/lib/workflow-filters";

const workflowActionTypeSchema = z.enum([
  "forward",
  "draft_reply",
  "apply_label",
  "archive",
]);

export const workflowIdSchema = z.uuid();

const filterConditionSchema = z.object({
  id: z.string().min(1),
  // Both sides are templates, and a half-written condition is a normal state
  // for a draft; `isConditionComplete` is what decides whether a run reads it.
  left: z.string(),
  operator: z.enum(filterOperatorNames),
  right: z.string(),
});

/**
 * A wire's filter. Every field is defaulted so rows written before wires could
 * carry one, where the key is simply absent, read back as an empty filter
 * rather than failing the whole workflow.
 */
export const workflowFilterSchema = z
  .object({
    enabled: z.boolean().default(true),
    name: z.string().default(""),
    match: z.enum(["all", "any"]).default("all"),
    caseSensitive: z.boolean().default(false),
    conditions: z.array(filterConditionSchema).default([]),
  })
  .default(() => createWorkflowFilter());

export const workflowActionSchema = z.object({
  id: z.string().min(1),
  type: workflowActionTypeSchema,
  filter: workflowFilterSchema,
  labelName: z.string(),
  forwardTo: z.string(),
  subjectPrefix: z.string(),
  note: z.string(),
  signature: z.string(),
  includeOriginalThread: z.boolean(),
  // Defaulted rather than required: rows saved before actions could carry files
  // have no such key, and they are read back through this schema.
  includeAttachments: z.boolean().default(true),
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
  // Blank is valid: `saveWorkflow` fills it with the next "New Workflow N".
  name: z.string().trim(),
  ownerRole: z.string(),
  trigger: z.string(),
  classifierPrompt: z.string(),
  classifierFilter: workflowFilterSchema,
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
 * One action as the workflow chat describes it: only the settings a spoken
 * description can decide. Every field is defaulted because a half-understood
 * workflow is the normal state mid-conversation, and a missing `note` should
 * not throw away the turn.
 */
export const workflowActionIntentSchema = z.object({
  type: workflowActionTypeSchema,
  forwardTo: z.string().default(""),
  labelName: z.string().default(""),
  subjectPrefix: z.string().default(""),
  note: z.string().default(""),
  draftInstructions: z.string().default(""),
});

export const classificationLabelIntentSchema = z.object({
  name: z.string().default(""),
  isCatchAll: z.boolean().default(false),
  actions: z.array(workflowActionIntentSchema).default([]),
});

/**
 * The whole of what the chat's model call is allowed to describe. It is
 * deliberately narrower than `workflowDraftSchema` (no ids, no filters, no
 * action defaults) because those are decided in
 * `src/lib/workflow-intent.ts`, not by a model.
 */
export const workflowIntentSchema = z.object({
  name: z.string().default(""),
  classifierPrompt: z.string().default(""),
  labels: z.array(classificationLabelIntentSchema).default([]),
});

const workflowChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  // Bounded because the whole history is posted on every turn, and it comes
  // from the browser. The bound lives with the example composer, which is the
  // one writer that can approach it.
  content: z.string().trim().min(1).max(chatMessageMaxLength),
});

/**
 * What the chat page sends on each turn: the conversation so far, oldest
 * first. The history is capped rather than trimmed silently: a conversation
 * this long has stopped being a setup chat.
 */
export const workflowChatInputSchema = z.object({
  messages: z
    .array(workflowChatMessageSchema)
    .min(1, "Say something first.")
    .max(40, "This conversation is too long. Start a new workflow."),
});

export type WorkflowChatInput = z.infer<typeof workflowChatInputSchema>;

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

/**
 * What the panel sends to pull one attachment's bytes out of Gmail: the message
 * it is on, and whichever handle that attachment has: `attachmentId` for a
 * body Gmail stored separately, `partId` for one that came inline. The bounds
 * are Gmail's own: an id is an opaque token, a part id is a dotted path.
 */
export const debugAttachmentSchema = z
  .object({
    messageId: z.string().min(1).max(256),
    attachmentId: z.string().max(4096),
    partId: z.string().max(64),
  })
  .refine((value) => value.attachmentId || value.partId, {
    message: "That attachment cannot be located on the message.",
  });

export type DebugAttachmentInput = z.infer<typeof debugAttachmentSchema>;
