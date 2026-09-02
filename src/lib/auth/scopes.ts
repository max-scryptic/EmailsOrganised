/**
 * Google OAuth scopes requested at sign-in.
 *
 * EmailsOrganised needs the mailbox itself, so identity and mailbox access are
 * granted in one consent screen rather than two. If sign-up conversion suffers,
 * the split is to drop GMAIL_SCOPES here and request them from a separate
 * "Connect your mailbox" action after the user is already inside the product.
 */

/** Basic profile. Never triggers Google verification review. */
export const IDENTITY_SCOPES = ["openid", "email", "profile"];

/**
 * `gmail.modify` is the single scope that covers reading messages, creating and
 * updating drafts, and sending — everything except permanent deletion. Asking
 * for it alone is narrower than combining gmail.readonly + compose + send.
 *
 * It is a RESTRICTED scope: the app stays capped at 100 test users until Google
 * completes OAuth verification, including a CASA security assessment.
 */
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

export const GOOGLE_SCOPES = [...IDENTITY_SCOPES, ...GMAIL_SCOPES];

export const GOOGLE_SCOPE_STRING = GOOGLE_SCOPES.join(" ");
