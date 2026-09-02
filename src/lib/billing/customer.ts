import "server-only";

import { getSessionUser } from "@/lib/auth/session";

/**
 * The auth ↔ billing seam.
 *
 * Every server-side billing call starts by asking "who is this?". Keeping that
 * question in one function means changing auth providers touches one file
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

export async function resolveBillingIdentity(): Promise<BillingIdentity> {
  const user = await getSessionUser();

  if (!user) {
    throw new UnauthenticatedBillingError();
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
  };
}
