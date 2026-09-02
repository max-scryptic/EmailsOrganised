import "server-only";

import { connection } from "next/server";
import { billingProviderId } from "@/lib/billing/config";
import { readSubscription } from "@/lib/billing/stripe/service";
import { emptySubscription, type BillingSubscription } from "@/lib/billing/types";
import { currentPlanId, planRenewalDate } from "@/lib/template-data";

/**
 * The read side of billing, for server components.
 *
 * Pages call this instead of importing `currentPlanId` directly, so turning
 * Stripe on swaps template data for live subscription state without touching
 * the pages.
 */

const mockSubscription: BillingSubscription = {
  planId: currentPlanId,
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: planRenewalDate,
  customerId: null,
  subscriptionId: null,
};

export async function getSubscription(): Promise<BillingSubscription> {
  if (billingProviderId !== "stripe") {
    return mockSubscription;
  }

  // Live subscription state is per-request, so stop prerendering here. Without
  // this, a page that reads it would be frozen at build time.
  await connection();

  try {
    return await readSubscription();
  } catch (error) {
    // A misconfigured key should not take the page down; the plan picker still
    // renders and the error surfaces when the customer tries to change plans.
    console.error("Failed to read the Stripe subscription", error);

    return emptySubscription;
  }
}
