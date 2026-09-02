import { AppShell } from "@/components/app-shell";
import { PlanSelector } from "@/components/pricing/plan-selector";
import { getSubscription } from "@/lib/billing/server";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  // Both resolve independently, so start them together.
  const [subscription, { checkout }] = await Promise.all([
    getSubscription(),
    searchParams,
  ]);

  return (
    <AppShell
      title="Manage plans"
      description="Compare tiers, select a plan, and confirm the change before it reaches the billing provider."
    >
      <PlanSelector
        subscription={subscription}
        checkoutStatus={
          checkout === "success" || checkout === "cancelled"
            ? checkout
            : undefined
        }
      />
    </AppShell>
  );
}
