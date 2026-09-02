import "server-only";

import { currentUser } from "@/lib/template-data";

/**
 * The auth ↔ billing seam.
 *
 * Every server-side billing call starts by asking "who is this?". Keeping that
 * question in one function means wiring a real auth provider touches one file
 * rather than every route handler.
 */

export type BillingIdentity = {
  /** Stable id from your auth provider. Stored on the Stripe customer. */
  userId: string;
  email: string;
  name?: string;
};

export class UnauthenticatedBillingError extends Error {
  constructor() {
    super("No signed-in user. Billing routes require an authenticated session.");
    this.name = "UnauthenticatedBillingError";
  }
}

/**
 * Returns the template user so the flow is clickable before auth exists.
 *
 * With Supabase, this becomes:
 *
 * ```ts
 * const supabase = await createServerClient();
 * const { data } = await supabase.auth.getUser();
 * if (!data.user) throw new UnauthenticatedBillingError();
 * return { userId: data.user.id, email: data.user.email!, name: ... };
 * ```
 *
 * With Clerk it is `auth()` plus `currentUser()`; with Auth.js, `auth()`.
 */
export async function resolveBillingIdentity(): Promise<BillingIdentity> {
  return {
    userId: "template-user",
    email: currentUser.email,
    name: currentUser.name,
  };
}
