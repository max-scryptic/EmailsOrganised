"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { billingAdapter } from "@/lib/billing/billing-adapter";
import { isMockBilling } from "@/lib/billing/config";

/**
 * Sends the customer to the provider's hosted billing portal.
 *
 * With Stripe that portal owns payment methods, invoices, and cancellations,
 * which is why the template ships no forms for them.
 */
export function BillingPortalButton({
  label = "Manage billing",
  variant = "outline",
}: {
  label?: string;
  variant?: "default" | "outline";
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await billingAdapter.openBillingPortal();

      if (result.outcome === "redirected") {
        // The browser is navigating away; keep the button disabled behind it.
        return;
      }

      setError(result.description);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not open the billing portal. Please try again.",
      );
    }

    setIsSubmitting(false);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        onClick={openPortal}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ExternalLink className="size-4" />
        )}
        {label}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="status">
          {error}
        </p>
      ) : null}
      {isMockBilling && !error ? (
        <p className="text-sm text-muted-foreground">
          Available once Stripe is configured.
        </p>
      ) : null}
    </div>
  );
}
