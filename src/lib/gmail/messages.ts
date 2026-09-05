import "server-only";

import type { DebugAttachment, DebugEmail } from "@/lib/workflow-debug";

/**
 * The read side of Gmail, used by debug mode to hear an email arrive and pull
 * it back in the shape the workflow variables describe.
 *
 * Reading only: nothing in this module writes to a mailbox. Access tokens come
 * from `@/lib/google/token-store`, which is the only place they are stored or
 * refreshed. Fetching an attachment's bytes is a read like any other — it is
 * `users.messages.attachments.get`, not a change to the message.
 */

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * How many recent messages a poll looks at. The watcher only ever wants the
 * newest one that arrived after listening started; a handful of candidates is
 * enough to survive a burst of mail landing at once.
 */
const pollBatchSize = 5;

/**
 * Bodies travel back to the browser inside the debug run, so they are capped.
 * Long enough to read and to classify on; short enough not to ship a megabyte
 * of quoted thread into a panel.
 */
const maxBodyLength = 20_000;

type GmailHeader = { name?: string; value?: string };

type GmailPart = {
  /** Gmail's address for this part in the MIME tree, e.g. `"1.2"`. */
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  /** Milliseconds since the epoch, as a string. */
  internalDate?: string;
  payload?: GmailPart;
};

export class GmailRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "GmailRequestError";
  }
}

async function gmailFetch(accessToken: string, path: string) {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GmailRequestError(
      response.status,
      `Gmail responded ${response.status} for ${path.split("?")[0]}.`
    );
  }

  return response.json();
}

/** The address of the connected mailbox, which is what `email.mailbox` is. */
export async function getMailboxAddress(accessToken: string) {
  const profile = (await gmailFetch(accessToken, "/profile")) as {
    emailAddress?: string;
  };

  return profile.emailAddress ?? "";
}

/**
 * Ids of inbox messages that arrived after `sinceMs`, newest first.
 *
 * Gmail's `after:` filter is only accurate to the day in some accounts, so the
 * precise cut is made against `internalDate` when each message is fetched — see
 * `fetchNewInboxMessage`.
 */
async function listRecentInboxMessageIds(accessToken: string, sinceMs: number) {
  const query = new URLSearchParams({
    q: `in:inbox after:${Math.floor(sinceMs / 1000)}`,
    maxResults: String(pollBatchSize),
  });
  const data = (await gmailFetch(
    accessToken,
    `/messages?${query.toString()}`
  )) as { messages?: { id: string }[] };

  return (data.messages ?? []).map((message) => message.id);
}

async function getMessage(accessToken: string, id: string) {
  return (await gmailFetch(
    accessToken,
    `/messages/${encodeURIComponent(id)}?format=full`
  )) as GmailMessage;
}

/**
 * The bytes of one attachment.
 *
 * Gmail splits this two ways. A part large enough to be stored separately
 * carries an `attachmentId` and its body has to be asked for by that id; a
 * small one (a signature image, a short text file) is handed over inside the
 * message itself, and `partId` is the only way back to it. `toDebugEmail`
 * records both, so a caller passes whichever the attachment has.
 */
export async function fetchAttachmentBytes({
  accessToken,
  messageId,
  attachmentId,
  partId,
}: {
  accessToken: string;
  messageId: string;
  /** Gmail's id for the stored body, blank when the bytes came inline. */
  attachmentId: string;
  /** The part's address in the MIME tree, used when there is no id. */
  partId: string;
}): Promise<Buffer> {
  if (attachmentId) {
    const attachment = (await gmailFetch(
      accessToken,
      `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(
        attachmentId
      )}`
    )) as { size?: number; data?: string };

    return Buffer.from(attachment.data ?? "", "base64url");
  }

  const message = await getMessage(accessToken, messageId);
  const part = findPart(message.payload, partId);

  if (!part?.body?.data) {
    throw new GmailRequestError(
      404,
      "That attachment is no longer part of the message."
    );
  }

  return Buffer.from(part.body.data, "base64url");
}

/** The part at `partId`, walking the MIME tree the same way bodies are found. */
function findPart(
  part: GmailPart | undefined,
  partId: string
): GmailPart | null {
  if (!part) {
    return null;
  }

  if (part.partId === partId) {
    return part;
  }

  for (const child of part.parts ?? []) {
    const found = findPart(child, partId);

    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * The newest inbox message that arrived after `sinceMs` and has not been
 * handed back already, or null while nothing new has landed.
 */
export async function fetchNewInboxMessage({
  accessToken,
  sinceMs,
  seenIds,
  mailbox,
}: {
  accessToken: string;
  sinceMs: number;
  seenIds: string[];
  mailbox: string;
}): Promise<DebugEmail | null> {
  const ids = await listRecentInboxMessageIds(accessToken, sinceMs);
  const seen = new Set(seenIds);

  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }

    const message = await getMessage(accessToken, id);
    const receivedMs = Number(message.internalDate ?? 0);

    // `after:` can hand back messages from earlier the same day, which would
    // replay old mail as if it had just arrived.
    if (!Number.isFinite(receivedMs) || receivedMs < sinceMs) {
      continue;
    }

    return toDebugEmail(message, mailbox);
  }

  return null;
}

export function toDebugEmail(
  message: GmailMessage,
  mailbox: string
): DebugEmail {
  const headers = message.payload?.headers ?? [];
  const from = parseAddress(header(headers, "From"));
  const receivedMs = Number(message.internalDate ?? 0);

  return {
    id: message.id,
    threadId: message.threadId,
    subject: header(headers, "Subject"),
    fromName: from.name,
    fromAddress: from.address,
    to: header(headers, "To"),
    cc: header(headers, "Cc"),
    replyTo: header(headers, "Reply-To"),
    snippet: decodeEntities(message.snippet ?? ""),
    bodyText: findBody(message.payload, "text/plain"),
    bodyHtml: findBody(message.payload, "text/html"),
    receivedAt: new Date(
      Number.isFinite(receivedMs) && receivedMs > 0 ? receivedMs : Date.now()
    ).toISOString(),
    labels: message.labelIds ?? [],
    isUnread: (message.labelIds ?? []).includes("UNREAD"),
    attachments: collectAttachments(message.payload),
    mailbox,
  };
}

function header(headers: GmailHeader[], name: string) {
  const match = headers.find(
    (candidate) => candidate.name?.toLowerCase() === name.toLowerCase()
  );

  return match?.value ?? "";
}

/** `"Ada Lovelace" <ada@example.com>` → name and address, either may be blank. */
function parseAddress(value: string) {
  const angled = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value);

  if (angled) {
    return {
      name: angled[1].replace(/^"|"$/g, "").trim(),
      address: angled[2].trim(),
    };
  }

  return { name: "", address: value.trim() };
}

/**
 * The first part of the wanted type, walking the MIME tree. Multipart messages
 * nest — `multipart/mixed` around a `multipart/alternative` around the two
 * bodies — so this cannot just read `payload.parts`.
 */
function findBody(part: GmailPart | undefined, mimeType: string): string {
  if (!part) {
    return "";
  }

  // An attachment can share the mime type of the body; it is never the body.
  if (part.mimeType === mimeType && !part.filename && part.body?.data) {
    return decodeBase64Url(part.body.data).slice(0, maxBodyLength);
  }

  for (const child of part.parts ?? []) {
    const found = findBody(child, mimeType);

    if (found) {
      return found;
    }
  }

  return "";
}

/**
 * Every attachment in the message, in MIME order, with what it takes to ask
 * for its bytes later.
 *
 * A named part is an attachment: that is the same test the names-only version
 * of this used, so an inline signature image is still counted — it is just
 * marked, because the panel showing three attachments when the user sent one
 * is a question rather than a bug.
 */
function collectAttachments(part: GmailPart | undefined): DebugAttachment[] {
  if (!part) {
    return [];
  }

  const own: DebugAttachment[] = part.filename
    ? [
        {
          attachmentId: part.body?.attachmentId ?? "",
          partId: part.partId ?? "",
          filename: part.filename,
          mimeType: part.mimeType ?? "application/octet-stream",
          size: part.body?.size ?? 0,
          inline: isInlinePart(part),
        },
      ]
    : [];
  const nested = (part.parts ?? []).flatMap(collectAttachments);

  return [...own, ...nested];
}

/** A part the HTML body references rather than one hung off the message. */
function isInlinePart(part: GmailPart) {
  const headers = part.headers ?? [];

  return (
    header(headers, "Content-Disposition").toLowerCase().startsWith("inline") ||
    Boolean(header(headers, "Content-ID"))
  );
}

function decodeBase64Url(data: string) {
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

/** Gmail HTML-escapes the snippet it returns; the panel shows plain text. */
function decodeEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
