import { billingProviderId } from "@/lib/billing/config";
import { mockBillingProvider } from "@/lib/billing/providers/mock-provider";
import { stripeBillingProvider } from "@/lib/billing/providers/stripe-provider";
import type { BillingProvider } from "@/lib/billing/types";

/**
 * The single entry point components use for billing mutations.
 *
 * Which provider answers is decided by `NEXT_PUBLIC_BILLING_PROVIDER`, so a
 * project turns billing on by adding environment variables rather than by
 * editing UI.
 */
export const billingAdapter: BillingProvider =
  billingProviderId === "stripe" ? stripeBillingProvider : mockBillingProvider;

export type {
  BillingOutcome,
  BillingResult,
  BillingSubscription,
  PlanChangeInput,
  SalesContactInput,
  SubscriptionStatus,
} from "@/lib/billing/types";
