/**
 * Client-safe billing configuration.
 *
 * Only `NEXT_PUBLIC_*` values belong here — this module is imported by client
 * components. Secret keys and price IDs live in `src/lib/billing/stripe/env.ts`,
 * which is server-only.
 */

export type BillingProviderId = "mock" | "stripe";

/**
 * `mock` is the default so a freshly cloned template runs with no `.env` at
 * all. Set `NEXT_PUBLIC_BILLING_PROVIDER=stripe` once Stripe keys are in place.
 */
export const billingProviderId: BillingProviderId =
  process.env.NEXT_PUBLIC_BILLING_PROVIDER === "stripe" ? "stripe" : "mock";

export const isMockBilling = billingProviderId === "mock";

/** API routes that own every server-side call to the billing provider. */
export const billingRoutes = {
  checkout: "/api/billing/checkout",
  portal: "/api/billing/portal",
  webhook: "/api/billing/webhook",
} as const;

/** Where the provider's hosted pages send the customer back to. */
export const billingReturnPaths = {
  checkoutSuccess: "/plans?checkout=success",
  checkoutCancelled: "/plans?checkout=cancelled",
  portalReturn: "/settings",
} as const;
