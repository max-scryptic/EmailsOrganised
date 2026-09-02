import "server-only";

import type { PlanId } from "@/lib/template-data";

/**
 * Server-side Stripe configuration.
 *
 * `server-only` makes importing this from a client component a build error, so
 * the secret key cannot reach the browser by accident.
 */

function read(name: string) {
  const value = process.env[name];

  return value && value.length > 0 ? value : undefined;
}

/**
 * Price IDs are per-environment (test mode and live mode issue different ones),
 * which is why they are env vars rather than constants in `template-data.ts`.
 * Add an entry here whenever a plan is added to `plans`.
 */
const priceEnvNames: Record<PlanId, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  scale: "STRIPE_PRICE_SCALE",
};

export const stripeEnv = {
  secretKey: read("STRIPE_SECRET_KEY"),
  webhookSecret: read("STRIPE_WEBHOOK_SECRET"),
  priceIds: Object.fromEntries(
    Object.entries(priceEnvNames).map(([planId, envName]) => [
      planId,
      read(envName),
    ]),
  ) as Record<PlanId, string | undefined>,
  /** Absolute base URL Stripe redirects back to after Checkout or the portal. */
  appUrl: read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
};

/**
 * Thrown when Stripe is switched on but an environment variable is missing.
 * Route handlers turn this into a 500 with an actionable message instead of a
 * generic Stripe SDK error.
 */
export class BillingConfigurationError extends Error {
  constructor(missing: string[]) {
    super(
      `Stripe billing is enabled but these environment variables are missing: ${missing.join(
        ", ",
      )}. See .env.example.`,
    );
    this.name = "BillingConfigurationError";
  }
}

export function requireSecretKey(): string {
  if (!stripeEnv.secretKey) {
    throw new BillingConfigurationError(["STRIPE_SECRET_KEY"]);
  }

  return stripeEnv.secretKey;
}

export function requireWebhookSecret(): string {
  if (!stripeEnv.webhookSecret) {
    throw new BillingConfigurationError(["STRIPE_WEBHOOK_SECRET"]);
  }

  return stripeEnv.webhookSecret;
}

export function requirePriceId(planId: PlanId): string {
  const priceId = stripeEnv.priceIds[planId];

  if (!priceId) {
    throw new BillingConfigurationError([priceEnvNames[planId]]);
  }

  return priceId;
}

/** Reverse lookup used by the webhook to turn a Stripe price back into a plan. */
export function planIdForPriceId(priceId: string): PlanId | null {
  const match = Object.entries(stripeEnv.priceIds).find(
    ([, configured]) => configured === priceId,
  );

  return match ? (match[0] as PlanId) : null;
}

export function absoluteUrl(path: string): string {
  return new URL(path, stripeEnv.appUrl).toString();
}
