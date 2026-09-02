import "server-only";

import type Stripe from "stripe";
import { billingReturnPaths } from "@/lib/billing/config";
import {
  resolveBillingIdentity,
  type BillingIdentity,
} from "@/lib/billing/customer";
import { billingStore } from "@/lib/billing/store";
import { getStripeClient } from "@/lib/billing/stripe/client";
import { absoluteUrl, requirePriceId } from "@/lib/billing/stripe/env";
import {
  primaryItem,
  toStoredSubscription,
} from "@/lib/billing/stripe/subscription";
import {
  emptySubscription,
  type BillingSubscription,
  type CheckoutResponse,
  type PlanChangeInput,
  type PortalResponse,
} from "@/lib/billing/types";
import { plans, type PlanId } from "@/lib/template-data";

/**
 * Everything the `/api/billing/*` routes need from Stripe.
 *
 * The routes stay thin: parse, call one of these, serialise. Business rules
 * (when to check out vs. update in place, how to prorate) live here.
 */

/** Metadata key that ties a Stripe object back to a row in your own database. */
export const APP_USER_ID_KEY = "appUserId";

function planName(planId: PlanId) {
  return plans.find((plan) => plan.id === planId)?.name ?? planId;
}

/**
 * Stripe's search query language quotes values with single quotes and has no
 * documented escape, so ids that could break out of the quoting are not
 * searched for — they fall through to the create path instead.
 */
const SEARCHABLE_USER_ID = /^[A-Za-z0-9_.:@|-]+$/;

/**
 * Looks up the Stripe customer for a user, store first and Stripe second.
 *
 * The Stripe lookup is what keeps the template correct with the default
 * in-memory store: the store is a cache, Stripe is the source of truth.
 */
async function findCustomerId(
  identity: BillingIdentity,
): Promise<string | null> {
  const cached = await billingStore.getStripeCustomerId(identity.userId);

  if (cached) {
    return cached;
  }

  if (!SEARCHABLE_USER_ID.test(identity.userId)) {
    return null;
  }

  const stripe = getStripeClient();
  const found = await stripe.customers.search({
    query: `metadata['${APP_USER_ID_KEY}']:'${identity.userId}'`,
    limit: 1,
  });

  const customer = found.data[0];

  if (!customer) {
    return null;
  }

  await billingStore.saveStripeCustomerId(identity.userId, customer.id);

  return customer.id;
}

/**
 * Finds the Stripe customer for the signed-in user, creating one on first use.
 *
 * Stripe happily creates two customers with the same email, so the id is cached
 * in the billing store to keep a returning customer on one record.
 */
export async function getOrCreateCustomerId(
  identity: BillingIdentity,
): Promise<string> {
  const existing = await findCustomerId(identity);

  if (existing) {
    return existing;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: identity.email,
    name: identity.name,
    metadata: { [APP_USER_ID_KEY]: identity.userId },
  });

  await billingStore.saveStripeCustomerId(identity.userId, customer.id);

  return customer.id;
}

/**
 * The subscription a plan change should modify.
 *
 * `status: "all"` then filtering locally, rather than one call per status, so a
 * subscription that is past due still counts as the one to upgrade.
 */
async function findChangeableSubscription(
  customerId: string,
): Promise<Stripe.Subscription | null> {
  const stripe = getStripeClient();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  return (
    subscriptions.data.find((subscription) =>
      ["active", "trialing", "past_due", "unpaid"].includes(
        subscription.status,
      ),
    ) ?? null
  );
}

/**
 * Moves the customer onto `planId`.
 *
 * A customer without a subscription goes through hosted Checkout so Stripe can
 * collect a payment method. A customer who already subscribes has their
 * existing item swapped in place, which keeps them in the app instead of
 * bouncing through a second checkout.
 */
export async function changePlan({
  planId,
}: Pick<PlanChangeInput, "planId">): Promise<CheckoutResponse> {
  const stripe = getStripeClient();
  const identity = await resolveBillingIdentity();
  const customerId = await getOrCreateCustomerId(identity);
  const priceId = requirePriceId(planId);
  const existing = await findChangeableSubscription(customerId);

  if (!existing) {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Carried onto the subscription so the webhook can resolve the user
      // without a second API call.
      subscription_data: {
        metadata: { [APP_USER_ID_KEY]: identity.userId },
      },
      allow_promotion_codes: true,
      success_url: absoluteUrl(billingReturnPaths.checkoutSuccess),
      cancel_url: absoluteUrl(billingReturnPaths.checkoutCancelled),
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return { outcome: "redirected", url: session.url };
  }

  const item = primaryItem(existing);

  if (!item) {
    throw new Error(
      `Stripe subscription ${existing.id} has no items to update.`,
    );
  }

  const updated = await stripe.subscriptions.update(existing.id, {
    items: [{ id: item.id, price: priceId }],
    // Both directions settle on the next invoice: an upgrade adds a charge for
    // the remainder of the period, a downgrade adds a credit. To hold a
    // downgrade until the period boundary instead, swap this for a
    // `stripe.subscriptionSchedules` phase.
    proration_behavior: "create_prorations",
    metadata: { [APP_USER_ID_KEY]: identity.userId },
  });

  // Write through so the UI reflects the change before the webhook lands.
  await billingStore.upsertSubscription(
    toStoredSubscription(updated, identity.userId),
  );

  return { outcome: "applied", planId, planName: planName(planId) };
}

/** Opens Stripe's hosted portal for invoices, cards, and cancellations. */
export async function createPortalSession(): Promise<PortalResponse> {
  const stripe = getStripeClient();
  const identity = await resolveBillingIdentity();
  const customerId = await getOrCreateCustomerId(identity);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: absoluteUrl(billingReturnPaths.portalReturn),
  });

  return { url: session.url };
}

/**
 * The subscription to render.
 *
 * Reads the local store first — that is the point of keeping one — and falls
 * back to Stripe when the store is cold, which the in-memory default is after
 * every restart. It never creates a customer: a read should not have side
 * effects in Stripe.
 */
export async function readSubscription(): Promise<BillingSubscription> {
  const identity = await resolveBillingIdentity();
  const stored = await billingStore.getSubscriptionByUserId(identity.userId);

  if (stored) {
    return stored;
  }

  const customerId = await findCustomerId(identity);

  if (!customerId) {
    return emptySubscription;
  }

  const subscription = await findChangeableSubscription(customerId);

  if (!subscription) {
    return { ...emptySubscription, customerId };
  }

  const mapped = toStoredSubscription(subscription, identity.userId);
  await billingStore.upsertSubscription(mapped);

  return mapped;
}
