/**
 * The two policy documents the product has to be able to link to.
 *
 * Google will not verify an OAuth client that requests a restricted scope
 * (`gmail.modify` — see `src/lib/auth/scopes.ts`) without published, reachable
 * links to both, so these routes are a launch dependency rather than a nicety.
 * The copy in `src/app/(legal)` is an honest description of what the app does,
 * written by engineering and NOT yet reviewed by a lawyer.
 */
export const legalRoutes = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
} as const;

/** Shown on both documents. Bump whenever the copy materially changes. */
export const legalUpdatedAt = "2 September 2026";

/**
 * Where policy questions go. Placeholder until a real mailbox exists — change
 * it here and both documents follow.
 */
export const legalContactEmail = "privacy@emailsorganised.com";
