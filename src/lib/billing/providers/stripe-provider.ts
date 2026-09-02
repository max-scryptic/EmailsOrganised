import { billingRoutes } from "@/lib/billing/config";
import type {
  BillingErrorResponse,
  BillingProvider,
  BillingResult,
  CheckoutResponse,
  PlanChangeInput,
  PortalResponse,
  SalesContactInput,
} from "@/lib/billing/types";

/**
 * Browser-side half of the Stripe integration.
 *
 * It holds no Stripe SDK and no keys: every call goes to a route handler under
 * `/api/billing`, which is where the secret key and the customer lookup live.
 */

async function postJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  return readJson<T>(response);
}

async function postWithBody<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readJson<T>(response);
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | BillingErrorResponse
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error
        : `Billing request failed with status ${response.status}.`;

    throw new Error(message);
  }

  if (!payload) {
    throw new Error("Billing request returned an empty response.");
  }

  return payload as T;
}

function redirectTo(url: string) {
  window.location.assign(url);
}

export const stripeBillingProvider: BillingProvider = {
  id: "stripe",

  async changePlan({
    planId,
    planName,
    direction,
  }: PlanChangeInput): Promise<BillingResult> {
    const result = await postWithBody<CheckoutResponse>(billingRoutes.checkout, {
      planId,
    });

    if (result.outcome === "applied") {
      return {
        outcome: "applied",
        title: direction === "upgrade" ? "Plan upgraded" : "Plan changed",
        description: `Your subscription now bills on ${result.planName}. Stripe prorates the difference on the next invoice.`,
      };
    }

    redirectTo(result.url);

    return {
      outcome: "redirected",
      title: "Opening Stripe Checkout",
      description: `Finish setting up ${planName} in the Stripe checkout page.`,
    };
  },

  async requestSalesContact({
    planName,
  }: SalesContactInput): Promise<BillingResult> {
    // Sales-led plans never touch Stripe: there is no self-serve price to buy.
    // Replace this with the CRM or scheduling handoff the project uses.
    return {
      outcome: "pending",
      title: "Sales request sent",
      description: `${planName} is sold with onboarding. Wire this handler to a CRM handoff or a scheduling link before launch.`,
    };
  },

  async openBillingPortal(): Promise<BillingResult> {
    const result = await postJson<PortalResponse>(billingRoutes.portal);

    redirectTo(result.url);

    return {
      outcome: "redirected",
      title: "Opening the billing portal",
      description:
        "Stripe handles payment methods, invoices, and cancellations from here.",
    };
  },
};
