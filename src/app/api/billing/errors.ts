import "server-only";

import { UnauthenticatedBillingError } from "@/lib/billing/customer";
import { BillingConfigurationError } from "@/lib/billing/stripe/env";
import type { BillingErrorResponse } from "@/lib/billing/types";

/**
 * One place that decides what a failed billing call looks like to the browser.
 *
 * Configuration mistakes are the most common failure while wiring a new
 * project up, so their message is passed through verbatim — it names the
 * missing environment variable. Everything else is logged and generalised so
 * Stripe internals never reach the client.
 */
export function billingErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedBillingError) {
    return jsonError(error.message, 401);
  }

  if (error instanceof BillingConfigurationError) {
    console.error(error);

    return jsonError(error.message, 500);
  }

  console.error("Billing request failed", error);

  return jsonError(
    "Billing is temporarily unavailable. Please try again.",
    500,
  );
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message } satisfies BillingErrorResponse, {
    status,
  });
}
