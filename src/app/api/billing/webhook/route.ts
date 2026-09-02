import type Stripe from "stripe";
import { billingStore } from "@/lib/billing/store";
import { getStripeClient } from "@/lib/billing/stripe/client";
import {
  BillingConfigurationError,
  requireWebhookSecret,
} from "@/lib/billing/stripe/env";
import { APP_USER_ID_KEY } from "@/lib/billing/stripe/service";
import { toStoredSubscription } from "@/lib/billing/stripe/subscription";

/**
 * Stripe's callback into the app. This is what makes subscription state real:
 * checkout and the portal both finish on Stripe's side, and the app only learns
 * the outcome here.
 *
 * Local development:
 *   stripe listen --forward-to localhost:3000/api/billing/webhook
 *
 * Notes for anyone extending this:
 * - The signature is checked against the *raw* body, so read `request.text()`
 *   and never `request.json()` before verifying.
 * - Stripe retries on any non-2xx, so handlers must be idempotent. Returning
 *   200 for an event you chose to ignore is correct; returning 500 asks Stripe
 *   to send it again.
 */

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    const payload = await request.text();

    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      requireWebhookSecret(),
    );
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      console.error(error);

      return Response.json({ error: error.message }, { status: 500 });
    }

    // A bad signature is not retryable, so answer 400 rather than 500.
    console.error("Stripe webhook signature verification failed", error);

    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    // 500 tells Stripe to retry, which is what a transient database failure
    // deserves.
    console.error(`Failed to handle Stripe event ${event.type}`, error);

    return Response.json({ error: "Handler failed." }, { status: 500 });
  }

  return Response.json({ received: true });
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      if (session.mode !== "subscription" || !session.subscription) {
        return;
      }

      await syncSubscription(idOf(session.subscription));

      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await persistSubscription(event.data.object);

      return;
    }

    case "customer.subscription.deleted": {
      await billingStore.removeSubscription(event.data.object.id);

      return;
    }

    case "invoice.payment_failed": {
      // Dunning hook: the place to email the customer or flag the account.
      // The subscription's own `past_due` update arrives separately.
      console.warn(
        `Stripe invoice payment failed for customer ${String(
          event.data.object.customer,
        )}`,
      );

      return;
    }

    default:
      // Every other event type is deliberately ignored. Add a case when the
      // product needs it, and enable that event in the Stripe dashboard.
      return;
  }
}

async function syncSubscription(subscriptionId: string) {
  const stripe = getStripeClient();

  await persistSubscription(await stripe.subscriptions.retrieve(subscriptionId));
}

async function persistSubscription(subscription: Stripe.Subscription) {
  const userId = await resolveUserId(subscription);

  if (!userId) {
    // Nothing to attach the subscription to. This usually means the customer
    // was created outside the app, so it is a warning rather than a failure.
    console.warn(
      `Stripe subscription ${subscription.id} has no ${APP_USER_ID_KEY} metadata.`,
    );

    return;
  }

  await billingStore.upsertSubscription(
    toStoredSubscription(subscription, userId),
  );
}

/**
 * Subscriptions created through this app carry the user id in metadata. Ones
 * created in the Stripe dashboard do not, so fall back to the customer record.
 */
async function resolveUserId(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromSubscription = subscription.metadata?.[APP_USER_ID_KEY];

  if (fromSubscription) {
    return fromSubscription;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(
    idOf(subscription.customer),
  );

  if (customer.deleted) {
    return null;
  }

  return customer.metadata?.[APP_USER_ID_KEY] ?? null;
}

function idOf(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}
