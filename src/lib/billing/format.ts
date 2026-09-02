import type { BillingSubscription, SubscriptionStatus } from "@/lib/billing/types";

/**
 * Presentation helpers shared by `/plans` and `/settings`.
 *
 * The formatter pins locale and time zone so a date rendered on the server
 * matches the one React renders in the browser — an unpinned `toLocaleString`
 * is a classic hydration mismatch.
 */

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function formatBillingDate(isoDate: string | null): string | null {
  if (!isoDate) {
    return null;
  }

  const date = new Date(isoDate);

  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}

/** One line describing where the subscription stands, e.g. "Renews May 1, 2026". */
export function formatRenewal(subscription: BillingSubscription): string {
  const date = formatBillingDate(subscription.currentPeriodEnd);

  if (subscription.status === "none" || !subscription.planId) {
    return "No active subscription";
  }

  if (!date) {
    return statusLabel(subscription.status);
  }

  if (subscription.cancelAtPeriodEnd) {
    return `Ends ${date}`;
  }

  if (subscription.status === "past_due") {
    return `Payment overdue since ${date}`;
  }

  if (subscription.status === "trialing") {
    return `Trial ends ${date}`;
  }

  return `Renews ${date}`;
}

export function statusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "trialing":
      return "Trialing";
    case "active":
      return "Active";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Canceled";
    case "none":
      return "No subscription";
  }
}
