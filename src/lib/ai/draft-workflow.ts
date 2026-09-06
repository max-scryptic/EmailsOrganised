import "server-only";

import {
  ModelError,
  isModelConfigured,
  postChatCompletion,
  readMessageContent,
} from "@/lib/ai/openai";
import { actionLabels } from "@/lib/workflow-data";
import type { WorkflowIntent } from "@/lib/workflow-intent";

/**
 * The chat that drafts a workflow from a description.
 *
 * The user says "forward all sales emails to xyz@" and this holds the short
 * conversation that turns it into something the builder can open. It is the
 * second place the product speaks to a model (`classify-email.ts` is the
 * other), and it uses the same trick: the answer is decoded against a JSON
 * schema, so every turn comes back as a reply *and* the workflow as understood
 * so far, never as prose the app then has to parse.
 *
 * What comes back is a `WorkflowIntent`, not a `WorkflowDraft`: no ids, no
 * filters, no action defaults. `buildDraftFromIntent` in
 * `src/lib/workflow-intent.ts` is what turns it into a draft, and it is where
 * the rules that must not be left to a model live.
 */

/**
 * Drafting is a harder job than classifying, since it writes a prompt someone
 * else's mail will be judged by, but it runs a handful of times per user rather than
 * once per email. `OPENAI_CHAT_MODEL` points it at a stronger model when the
 * conversations are worth more than the cost.
 */
const defaultModel = "gpt-4o-mini";

/** A drafting failure with a message safe to show the person in the chat. */
export class WorkflowChatError extends ModelError {}

/** False when no API key is set, which the chat page says out loud. */
export const isWorkflowChatConfigured = isModelConfigured;

export function workflowChatModel() {
  return process.env.OPENAI_CHAT_MODEL?.trim() || defaultModel;
}

export type WorkflowChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type WorkflowChatAnswer = {
  /** What the assistant says back. Plain language, no JSON, no jargon. */
  reply: string;
  /** The assistant's own view of whether the workflow is worth opening yet. */
  ready: boolean;
  /** The workflow as understood so far, or null before there is one. */
  intent: WorkflowIntent | null;
};

export async function draftWorkflow(
  messages: WorkflowChatMessage[]
): Promise<WorkflowChatAnswer> {
  const response = await postChatCompletion(
    {
      model: workflowChatModel(),
      messages: [
        { role: "system", content: systemPrompt() },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "workflow_draft",
          strict: true,
          schema: answerSchema,
        },
      },
    },
    (message) => new WorkflowChatError(message)
  );

  return readAnswer(response);
}

function systemPrompt() {
  const actions = Object.entries(actionLabels)
    .map(([type, label]) => `- ${type}: ${label}`)
    .join("\n");

  return [
    "You help someone set up an email triage workflow by talking to them. They are not technical. They should never have to learn what a classifier, a branch, or a variable is.",

    "HOW A WORKFLOW WORKS. Every email that arrives is read by a classification step, which must sort it into exactly one of the labels you define. Each label is a branch, and a branch runs a list of actions. The actions available are:",
    actions,

    "THE MOST IMPORTANT RULE. The labels you define are the only answers the classification is allowed to give. So there must always be a catch-all label, somewhere for every email the user did not ask about to land, and it must have no actions, because that is where a run is supposed to stop. A workflow with only one label would send every email in the mailbox down that one branch. Set `isCatchAll` to true on that label and name it something plain like \"Other\" or \"Everything else\".",

    "HOW TO TALK. Ask one short question at a time and wait for the answer. Do not present a numbered list of questions. Keep every reply to a few sentences. Never mention JSON, schemas, labels, branches, prompts, or any other internal word; say \"emails like this\", \"what should happen to them\", \"everything else\".",

    "WHAT YOU NEED BEFORE A WORKFLOW IS READY. Which emails the user cares about; what should happen to those emails, specifically enough to carry out (an exact address to forward to, an exact tag name); and examples. Ask for two or three real examples of the emails they want caught, and, this matters, also ask what kinds of email they get that look similar but should be left alone. Without both sides you cannot describe where the line falls.",

    "NEVER USE AN EM DASH. Not in `reply`, not in `classifierPrompt`, not in a label name or an action setting. Everything you write is saved into the product, and the product does not use them. Use a comma, a colon, a semicolon, parentheses, or two sentences.",

    "NEVER INVENT DETAILS. Use only email addresses, tag names, and company names the user actually typed. If you need an address and do not have one, ask. An invented forwarding address sends someone's mail to a stranger.",

    "WRITING `classifierPrompt`. This is the instruction the classification follows for every email, so write it for a reader who cannot see this conversation. Describe what belongs under each label in the user's own terms, and work their examples and counter-examples into it as the evidence for where the line sits. A few sentences is right.",

    "EACH TURN. Put what you want to say in `reply`. Put the workflow as you currently understand it in `workflow`, filling in as much as you know so far and leaving the rest empty; send null only before the user has described anything at all. Set `ready` to true once the workflow would genuinely do something useful: a prompt that describes the line, a catch-all, and at least one branch with an action whose settings are filled in. When you set `ready`, say in `reply` what the workflow will do, in one or two plain sentences, and tell them they can open it in the editor to see it.",
  ].join("\n\n");
}

/**
 * The shape every turn is decoded against. Written out by hand rather than
 * derived from the zod schema because OpenAI's strict mode has its own rules:
 * every property required, `additionalProperties` false throughout, and
 * optionality expressed as a nullable type.
 */
const answerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "ready", "workflow"],
  properties: {
    reply: { type: "string" },
    ready: { type: "boolean" },
    workflow: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["name", "classifierPrompt", "labels"],
      properties: {
        name: {
          type: "string",
          description: "A short name for the workflow, in the user's words.",
        },
        classifierPrompt: { type: "string" },
        labels: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "isCatchAll", "actions"],
            properties: {
              name: { type: "string" },
              isCatchAll: { type: "boolean" },
              actions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "type",
                    "forwardTo",
                    "labelName",
                    "subjectPrefix",
                    "note",
                    "draftInstructions",
                  ],
                  properties: {
                    type: {
                      type: "string",
                      enum: ["forward", "draft_reply", "apply_label", "archive"],
                    },
                    forwardTo: {
                      type: "string",
                      description:
                        "Address a forward goes to. Only ever one the user typed.",
                    },
                    labelName: {
                      type: "string",
                      description: "The tag a tag action applies.",
                    },
                    subjectPrefix: { type: "string" },
                    note: { type: "string" },
                    draftInstructions: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Reads one turn out of the response. Structured outputs make the shape a
 * near-certainty, so this reads defensively rather than validating twice; the
 * server action parses the result with zod before it reaches the client.
 */
function readAnswer(response: unknown): WorkflowChatAnswer {
  const content = readMessageContent(
    response,
    (message) => new WorkflowChatError(message)
  );

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new WorkflowChatError("The model's answer was not valid JSON.");
  }

  const answer = parsed as {
    reply?: unknown;
    ready?: unknown;
    workflow?: unknown;
  };

  if (typeof answer.reply !== "string" || !answer.reply.trim()) {
    throw new WorkflowChatError("The model returned an empty reply.");
  }

  return {
    reply: answer.reply,
    ready: answer.ready === true,
    intent: (answer.workflow as WorkflowIntent | null) ?? null,
  };
}
