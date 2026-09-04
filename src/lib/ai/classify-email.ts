import "server-only";

/**
 * The classification step's model call.
 *
 * The user writes the prompt and names the output labels; this turns the two
 * into a single cheap GPT call whose answer *cannot* be anything but one of
 * those labels. The forcing is not a plea in the prompt — it is the JSON schema
 * the response is decoded against, where `label` is an enum of exactly the
 * labels the workflow declares. A model that wants to answer "Billing" when the
 * workflow only offers Sales / FAQ / Important is not able to.
 */

const defaultBaseUrl = "https://api.openai.com/v1";

/**
 * `OPENAI_BASE_URL` points the call at an OpenAI-compatible gateway instead —
 * a proxy, a self-hosted endpoint, or a stub while developing.
 */
function chatCompletionsEndpoint() {
  const base = (process.env.OPENAI_BASE_URL?.trim() || defaultBaseUrl).replace(
    /\/+$/,
    ""
  );

  return `${base}/chat/completions`;
}

/**
 * A small, cheap model is the right tool here: the job is one short label from
 * a closed set, and the schema does the hard part. Override it with
 * `OPENAI_CLASSIFIER_MODEL` when a cheaper or newer one comes along.
 */
const defaultModel = "gpt-4o-mini";

/** How long a single classification is allowed to take before it is dropped. */
const requestTimeoutMs = 20_000;

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
export class ClassificationError extends Error {}

/** False when no API key is set, which every caller should say out loud. */
export const isClassificationConfigured = Boolean(process.env.OPENAI_API_KEY);

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
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new ClassificationError(
      "No OpenAI API key is configured. Set OPENAI_API_KEY to run classifications."
    );
  }

  if (labels.length === 0) {
    throw new ClassificationError(
      "A classification needs at least one output label."
    );
  }

  const response = await postJson(
    chatCompletionsEndpoint(),
    apiKey,
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
    }
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

async function postJson(url: string, apiKey: string, body: unknown) {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    throw new ClassificationError(
      error instanceof Error && error.name === "TimeoutError"
        ? "The model did not answer in time. Try again."
        : "Could not reach the model. Check the network and try again."
    );
  }

  if (!response.ok) {
    throw new ClassificationError(await apiErrorMessage(response));
  }

  return (await response.json()) as unknown;
}

/**
 * The API's own message is the most useful thing to show — it names a bad key,
 * an unknown model, or a rate limit precisely — so it is surfaced rather than
 * flattened into "something went wrong".
 */
async function apiErrorMessage(response: Response) {
  const detail = await response
    .json()
    .then((body) =>
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error?: { message?: unknown } }).error?.message ===
        "string"
        ? (body as { error: { message: string } }).error.message
        : ""
    )
    .catch(() => "");

  if (response.status === 401) {
    return "The OpenAI API key was rejected. Check OPENAI_API_KEY.";
  }

  if (response.status === 429) {
    return "The model is rate limited right now. Try again in a moment.";
  }

  return detail || `The model returned ${response.status}.`;
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
  const message = (
    response as {
      choices?: { message?: { content?: unknown; refusal?: unknown } }[];
    }
  )?.choices?.[0]?.message;

  if (typeof message?.refusal === "string" && message.refusal) {
    throw new ClassificationError(`The model declined: ${message.refusal}`);
  }

  if (typeof message?.content !== "string") {
    throw new ClassificationError("The model returned an empty answer.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(message.content);
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
