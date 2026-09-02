import "server-only";

import type Stripe from "stripe";
import { planIdForPriceId } from "@/lib/billing/stripe/env";
import type { StoredSubscription } from "@/lib/billing/store";
import type { SubscriptionStatus } from "@/lib/billing/types";

/**
 * Translation between Stripe's subscription shape and the template's.
 *
 * Doing it in one place means the rest of the app never learns Stripe's field
 * names, and API changes land here instead of in components.
 */

/**
 * Stripe has more states than a product UI needs. `incomplete` and `unpaid`
 * both mean "we are waiting on money", so they collapse onto `past_due`.
 */
export function toSubscriptionStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return "none";
  }
}

/** The item a single-plan subscription bills on. */
export function primaryItem(
  subscription: Stripe.Subscription,
): Stripe.SubscriptionItem | undefined {
  return subscription.items.data[0];
}

/**
 * As of Stripe API version 2025-03-31 the billing period moved from the
 * subscription onto its items, so the renewal date is read from the item.
 */
export function toStoredSubscription(
  subscription: Stripe.Subscription,
  userId: string,
): StoredSubscription {
  const item = primaryItem(subscription);
  const priceId = item?.price.id;

  return {
    userId,
    planId: priceId ? planIdForPriceId(priceId) : null,
    status: toSubscriptionStatus(subscription.status),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: item
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
    customerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    subscriptionId: subscription.id,
  };
}
