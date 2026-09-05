"use server";

import {
  ClassificationError,
  classifyEmail,
} from "@/lib/ai/classify-email";
import { requireUser } from "@/lib/auth/session";
import {
  fetchNewInboxMessage,
  getMailboxAddress,
  GmailRequestError,
} from "@/lib/gmail/messages";
import { getGoogleAccessToken } from "@/lib/google/token-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { applyVariables } from "@/lib/workflow-variables";
import type { DebugClassification, DebugEmail } from "@/lib/workflow-debug";
import {
  debugClassifySchema,
  debugWatchPollSchema,
  type DebugClassifyInput,
  type DebugWatchPollInput,
} from "@/lib/workflow-validation";

/**
 * The server half of debug mode: listening to the mailbox, and asking the model
 * which branch this email takes.
 *
 * Nothing here writes. The mailbox actions only ever read, and stepping through
 * the workflow is done in the browser against the draft on the board, so no
 * action a workflow describes is ever performed.
 */

/** Why listening could not start, so the dialog can offer the right way out. */
export type DebugWatchProblem = "unconfigured" | "disconnected" | "failed";

export type DebugWatchError = {
  status: "error";
  problem: DebugWatchProblem;
  title: string;
  description: string;
};

export type StartDebugWatchResult =
  | {
      status: "listening";
      /** Milliseconds since the epoch; only later mail counts as a trigger. */
      startedAt: number;
      mailbox: string;
    }
  | DebugWatchError;

export type PollDebugWatchResult =
  | { status: "waiting" }
  | { status: "received"; email: DebugEmail }
  | DebugWatchError;

const notConfigured: DebugWatchError = {
  status: "error",
  problem: "unconfigured",
  title: "No mailbox to listen to",
  description:
    "Supabase and Google are not configured in this environment, so there is no connected mailbox to watch. You can still step through the workflow with a sample email.",
};

const notConnected: DebugWatchError = {
  status: "error",
  problem: "disconnected",
  title: "Mailbox is not connected",
  description:
    "We do not hold mailbox access for your Google account any more. Sign in again to reconnect, or step through the workflow with a sample email.",
};

function requestFailed(error: unknown): DebugWatchError {
  const status = error instanceof GmailRequestError ? error.status : null;

  return {
    status: "error",
    problem: "failed",
    title: "Could not reach your mailbox",
    description:
      status === 401 || status === 403
        ? "Google refused the request. Sign in again to reconnect your mailbox."
        : "Gmail did not answer. Try again in a moment, or step through the workflow with a sample email.",
  };
}

/**
 * Opens a listening window. Only mail that arrives after this point counts, so
 * a test is triggered by an email the user sends now rather than by whatever
 * happened to be sitting at the top of the inbox.
 */
export async function startDebugWatch(): Promise<StartDebugWatchResult> {
  if (!isSupabaseConfigured) {
    return notConfigured;
  }

  const user = await requireUser();
  const accessToken = await getGoogleAccessToken(user.id);

  if (!accessToken) {
    return notConnected;
  }

  try {
    const mailbox = await getMailboxAddress(accessToken);

    return {
      status: "listening",
      startedAt: Date.now(),
      mailbox: mailbox || user.email,
    };
  } catch (error) {
    return requestFailed(error);
  }
}

/** One poll of the mailbox for the first message to arrive since `startedAt`. */
export async function pollDebugWatch(
  input: DebugWatchPollInput
): Promise<PollDebugWatchResult> {
  const parsed = debugWatchPollSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      problem: "failed",
      title: "Could not check your mailbox",
      description: "The listening session is invalid. Start the test again.",
    };
  }

  if (!isSupabaseConfigured) {
    return notConfigured;
  }

  const user = await requireUser();
  const accessToken = await getGoogleAccessToken(user.id);

  if (!accessToken) {
    return notConnected;
  }

  try {
    const email = await fetchNewInboxMessage({
      accessToken,
      sinceMs: parsed.data.startedAt,
      seenIds: parsed.data.seenIds,
      // Google is the only way in and one consent covers both, so the mailbox
      // is the account the user signed in with. `startDebugWatch` confirms that
      // against Gmail once; a poll does not spend a request re-asking.
      mailbox: user.email,
    });

    return email ? { status: "received", email } : { status: "waiting" };
  } catch (error) {
    return requestFailed(error);
  }
}

export type DebugClassifyResult =
  | { status: "classified"; classification: DebugClassification }
  | { status: "error"; description: string };

/**
 * Asks the model which branch this email takes — the same call the workflow
 * runs on, so a test shows the real answer rather than an approximation of it.
 *
 * A failure is returned rather than thrown: a run with no answer still steps,
 * and the panel lets the user pick a branch by hand instead.
 */
export async function classifyDebugEmail(
  input: DebugClassifyInput
): Promise<DebugClassifyResult> {
  const parsed = debugClassifySchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      description:
        parsed.error.issues[0]?.message ??
        "The classification needs a prompt and at least one named output.",
    };
  }

  await requireUser();

  const { prompt, labels, email } = parsed.data;

  try {
    const classification = await classifyEmail({
      // The prompt is written against the values the trigger produced, and the
      // run has them — so the model reads what the workflow would really send.
      prompt: applyVariables(prompt, email),
      labels,
      email: {
        subject: email["email.subject"] ?? "",
        from: email["email.from.address"] ?? "",
        body: email["email.body.text"] ?? email["email.snippet"] ?? "",
      },
    });

    return { status: "classified", classification };
  } catch (error) {
    return {
      status: "error",
      description:
        error instanceof ClassificationError
          ? error.message
          : "The classification could not be run.",
    };
  }
}
