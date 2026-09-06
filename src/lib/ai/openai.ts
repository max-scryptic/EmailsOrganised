import "server-only";

/**
 * The one place an OpenAI-compatible chat completion is posted from.
 *
 * Two features speak to a model: the classification behind a workflow node
 * (`classify-email.ts`) and the chat that drafts a workflow
 * (`draft-workflow.ts`). They want the same things from the transport: the
 * configured gateway, a timeout, and error messages that name a bad key or a
 * rate limit precisely instead of flattening them into "something went wrong".
 * Only the request body and how the answer is read differ, so only that lives
 * in the callers.
 */

const defaultBaseUrl = "https://api.openai.com/v1";

/** How long a single call is allowed to take before it is dropped. */
const requestTimeoutMs = 30_000;

/**
 * A model-call failure with a message that is safe to show the person who
 * triggered it. Callers subclass it so each surface can keep its own error
 * type while sharing this one's wording.
 */
export class ModelError extends Error {}

/** False when no API key is set, which every caller should say out loud. */
export const isModelConfigured = Boolean(process.env.OPENAI_API_KEY);

/**
 * `OPENAI_BASE_URL` points the call at an OpenAI-compatible gateway instead:
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
 * Posts one chat completion and returns the parsed response body.
 *
 * `wrap` turns this module's `ModelError` into the caller's own error type, so
 * a surface that checks `instanceof ClassificationError` keeps working.
 */
export async function postChatCompletion(
  body: unknown,
  wrap: (message: string) => ModelError = (message) => new ModelError(message)
): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw wrap(
      "No OpenAI API key is configured. Set OPENAI_API_KEY to use this feature."
    );
  }

  let response: Response;

  try {
    response = await fetch(chatCompletionsEndpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    throw wrap(
      error instanceof Error && error.name === "TimeoutError"
        ? "The model did not answer in time. Try again."
        : "Could not reach the model. Check the network and try again."
    );
  }

  if (!response.ok) {
    throw wrap(await apiErrorMessage(response));
  }

  return (await response.json()) as unknown;
}

/**
 * The API's own message is the most useful thing to show. It names a bad key,
 * an unknown model, or a rate limit precisely, so it is surfaced rather than
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
 * The assistant message out of a completion, with a refusal or an empty answer
 * raised as an error rather than returned as content.
 */
export function readMessageContent(
  response: unknown,
  wrap: (message: string) => ModelError
): string {
  const message = (
    response as {
      choices?: { message?: { content?: unknown; refusal?: unknown } }[];
    }
  )?.choices?.[0]?.message;

  if (typeof message?.refusal === "string" && message.refusal) {
    throw wrap(`The model declined: ${message.refusal}`);
  }

  if (typeof message?.content !== "string" || !message.content) {
    throw wrap("The model returned an empty answer.");
  }

  return message.content;
}
