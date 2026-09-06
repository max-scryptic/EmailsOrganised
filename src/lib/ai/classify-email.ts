import "server-only";

import {
  ModelError,
  isModelConfigured,
  postChatCompletion,
  readMessageContent,
} from "@/lib/ai/openai";

/**
 * The classification step's model call.
 *
 * The user writes the prompt and names the output labels; this turns the two
 * into a single cheap GPT call whose answer *cannot* be anything but one of
 * those labels. The forcing is not a plea in the prompt — it is the JSON schema
 * the response is decoded against, where `label` is an enum of exactly the
 * labels the workflow declares. A model that wants to answer "Billing" when the
 * workflow only offers Sales / FAQ / Important is not able to.
 *
 * The transport — endpoint, timeout, error wording — lives in `openai.ts`,
 * shared with the chat that drafts a workflow. What is owned here is the call
 * itself: the schema that closes the answer set, and how it is read back.
 */

/**
 * A small, cheap model is the right tool here: the job is one short label from
 * a closed set, and the schema does the hard part. Override it with
 * `OPENAI_CLASSIFIER_MODEL` when a cheaper or newer one comes along.
 */
const defaultModel = "gpt-4o-mini";

export type ClassificationEmail = {
  subject: string;
  from: string;
  body: string;
};

export type EmailClassification = {
  /** Always one of the labels that was passed in. */
  label: string;
  /** The model's own confidence, 0 to 1. */
  confidence: number;
  reasoning: string;
};

/** A failure with a message that is safe to show the person who triggered it. */
export class ClassificationError extends ModelError {}

/** False when no API key is set, which every caller should say out loud. */
export const isClassificationConfigured = isModelConfigured;

export function classifierModel() {
  return process.env.OPENAI_CLASSIFIER_MODEL?.trim() || defaultModel;
}

export async function classifyEmail({
  prompt,
  labels,
  email,
}: {
  /** The user's own instructions, with any `{{variables}}` already filled in. */
  prompt: string;
  /** The only answers the model may give. Must be non-empty and distinct. */
  labels: string[];
  email: ClassificationEmail;
}): Promise<EmailClassification> {
  if (labels.length === 0) {
    throw new ClassificationError(
      "A classification needs at least one output label."
    );
  }

  const response = await postChatCompletion(
    {
      model: classifierModel(),
      // Temperature is deliberately left at the model's default: the answer set
      // is closed and decoded against a schema, and several current models
      // reject a non-default temperature outright.
      messages: [
        { role: "system", content: systemPrompt(labels) },
        { role: "user", content: userPrompt(prompt, email) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_classification",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["label", "confidence", "reasoning"],
            properties: {
              // This enum is the whole mechanism.
              label: { type: "string", enum: labels },
              confidence: { type: "number" },
              reasoning: { type: "string" },
            },
          },
        },
      },
    },
    (message) => new ClassificationError(message)
  );

  return readClassification(response, labels);
}

function systemPrompt(labels: string[]) {
  return [
    "You classify a single email for an inbox triage workflow.",
    "Follow the user's instructions below to decide which one of these labels the email belongs to:",
    labels.map((label) => `- ${label}`).join("\n"),
    "Pick exactly one label, even when the fit is imperfect — say so in `reasoning` and lower `confidence` instead of refusing.",
    "`confidence` is a number from 0 to 1. `reasoning` is one short sentence.",
  ].join("\n\n");
}

function userPrompt(prompt: string, email: ClassificationEmail) {
  return [
    "Instructions:",
    prompt.trim(),
    "Email:",
    [
      `From: ${email.from}`,
      `Subject: ${email.subject}`,
      "",
      email.body,
    ].join("\n"),
  ].join("\n\n");
}

/**
 * Reads the one answer out of the response. Structured outputs make the shape
 * a near-certainty, but a refusal still comes back in place of content, and a
 * label outside the set would be a silent branch that never fires — so both
 * are checked rather than assumed.
 */
function readClassification(
  response: unknown,
  labels: string[]
): EmailClassification {
  const content = readMessageContent(
    response,
    (message) => new ClassificationError(message)
  );

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ClassificationError("The model's answer was not valid JSON.");
  }

  const answer = parsed as {
    label?: unknown;
    confidence?: unknown;
    reasoning?: unknown;
  };
  const label = labels.find((candidate) => candidate === answer.label);

  if (!label) {
    throw new ClassificationError(
      "The model answered with a label this classification does not offer."
    );
  }

  return {
    label,
    confidence:
      typeof answer.confidence === "number" && Number.isFinite(answer.confidence)
        ? Math.min(Math.max(answer.confidence, 0), 1)
        : 0,
    reasoning: typeof answer.reasoning === "string" ? answer.reasoning : "",
  };
}
