import type {
  BillingProvider,
  BillingResult,
  PlanChangeInput,
  SalesContactInput,
} from "@/lib/billing/types";

/**
 * The zero-config provider. It never calls a network, so `/plans` and
 * `/settings` keep their full loading, success, and error states before a
 * project has picked a billing backend.
 */

function delay(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockBillingProvider: BillingProvider = {
  id: "mock",

  async changePlan({
    planId,
    planName,
    direction,
  }: PlanChangeInput): Promise<BillingResult> {
    await delay();
    void planId;

    return {
      outcome: "applied",
      title: direction === "upgrade" ? "Plan upgraded" : "Plan changed",
      description:
        direction === "upgrade"
          ? `Mock switch to ${planName}. Set NEXT_PUBLIC_BILLING_PROVIDER=stripe to run this through Stripe Checkout instead.`
          : `Mock downgrade to ${planName}. Stripe would swap the subscription now and credit the unused time.`,
    };
  },

  async requestSalesContact({
    planName,
  }: SalesContactInput): Promise<BillingResult> {
    await delay();

    return {
      outcome: "pending",
      title: "Sales request sent",
      description: `Mock request for ${planName}. Wire this to a CRM handoff or a scheduling link before launch.`,
    };
  },

  async openBillingPortal(): Promise<BillingResult> {
    await delay();

    return {
      outcome: "pending",
      title: "Billing portal unavailable",
      description:
        "The mock provider has no hosted portal. Configure Stripe to open the real customer portal.",
    };
  },
};
