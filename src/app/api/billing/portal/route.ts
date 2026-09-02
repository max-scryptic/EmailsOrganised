import { billingErrorResponse } from "@/app/api/billing/errors";
import { createPortalSession } from "@/lib/billing/stripe/service";

/**
 * Hands the customer to Stripe's hosted billing portal.
 *
 * Payment methods, invoices, and cancellations are Stripe's job — this is why
 * `/settings` does not need forms for any of them.
 */
export async function POST() {
  try {
    return Response.json(await createPortalSession());
  } catch (error) {
    return billingErrorResponse(error);
  }
}
