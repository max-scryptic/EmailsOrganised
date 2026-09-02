import "server-only";

import Stripe from "stripe";
import { requireSecretKey } from "@/lib/billing/stripe/env";
import { appConfig } from "@/lib/template-data";

/**
 * Lazily created Stripe client.
 *
 * Constructing it on demand rather than at module scope keeps `next build` from
 * failing on a machine that has no Stripe keys, which is the default state of a
 * freshly cloned template.
 */

let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!client) {
    // The pinned API version ships with the SDK, so it is deliberately not set
    // here — upgrading `stripe` upgrades the API version in one place.
    client = new Stripe(requireSecretKey(), {
      appInfo: { name: appConfig.name },
    });
  }

  return client;
}
