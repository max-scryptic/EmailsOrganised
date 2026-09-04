"use server";

import { requireUser } from "@/lib/auth/session";
import {
  fetchNewInboxMessage,
  getMailboxAddress,
  GmailRequestError,
} from "@/lib/gmail/messages";
import { getGoogleAccessToken } from "@/lib/google/token-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DebugEmail } from "@/lib/workflow-debug";
import {
  debugWatchPollSchema,
  type DebugWatchPollInput,
} from "@/lib/workflow-validation";

/**
 * The listening half of debug mode.
 *
 * Both actions only ever read the mailbox. Stepping through the workflow is
 * done in the browser against the draft on the board, so nothing here runs a
 * workflow or writes to Gmail.
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
