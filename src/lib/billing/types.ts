import type { PlanId } from "@/lib/template-data";

/**
 * Provider-neutral billing contracts.
 *
 * Everything the UI touches is defined here so pages and components never
 * import a provider SDK. Swapping Stripe for Paddle, Lemon Squeezy, or a
 * homegrown ledger means writing one more `BillingProvider`, not editing
 * `/plans` or `/settings`.
 */

/** What actually happened to the subscription, so the UI knows what to trust. */
export type BillingOutcome =
  /** The subscription changed now. Safe to reflect the new plan immediately. */
  | "applied"
  /** The browser is being sent to a hosted page. The plan changes later. */
  | "redirected"
  /** Handed off to a human or an async process. The plan has not changed. */
  | "pending";

export type BillingResult = {
  outcome: BillingOutcome;
  title: string;
  description: string;
};

export type PlanChangeInput = {
  planId: PlanId;
  planName: string;
  direction: "upgrade" | "downgrade";
};

export type SalesContactInput = {
  planName: string;
};

/**
 * Normalised subscription status. Stripe has more states than a product UI
 * needs; map the long tail onto these before it reaches a component.
 */
export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type BillingSubscription = {
  /** `null` when the customer has never subscribed. */
  planId: PlanId | null;
  status: SubscriptionStatus;
  /** Set when a cancellation or downgrade takes effect at the period boundary. */
  cancelAtPeriodEnd: boolean;
  /** ISO date of the next renewal, or `null` when there is nothing to renew. */
  currentPeriodEnd: string | null;
  /** Provider-side identifiers, kept opaque to the UI. */
  customerId: string | null;
  subscriptionId: string | null;
};

/** A customer with no subscription yet — the safe default for a fresh account. */
export const emptySubscription: BillingSubscription = {
  planId: null,
  status: "none",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  customerId: null,
  subscriptionId: null,
};

/**
 * Wire format shared by the `/api/billing/*` route handlers and the client
 * provider that calls them. Kept here so both sides break together if it
 * changes.
 */
export type CheckoutResponse =
  | { outcome: "redirected"; url: string }
  | { outcome: "applied"; planId: PlanId; planName: string };

export type PortalResponse = { url: string };

export type BillingErrorResponse = { error: string };

/**
 * Implemented once per billing backend. The mock provider satisfies it without
 * any network calls so the template runs with an empty `.env`.
 */
export interface BillingProvider {
  readonly id: "mock" | "stripe";
  changePlan(input: PlanChangeInput): Promise<BillingResult>;
  requestSalesContact(input: SalesContactInput): Promise<BillingResult>;
  /** Opens the provider's hosted page for invoices and payment methods. */
  openBillingPortal(): Promise<BillingResult>;
}
