import "server-only";

import type { BillingSubscription } from "@/lib/billing/types";

/**
 * The persistence seam for billing state.
 *
 * Stripe is the source of truth for money, but the app needs its own copy of
 * "which plan is this user on" to gate features without a network call on every
 * request. Webhooks write here; pages read from here.
 *
 * The shipped implementation is an in-memory map. It is enough to click through
 * the whole flow locally and it keeps the template dependency-free, but it
 * resets on every server restart and is not shared between serverless
 * instances. Replace it with a real table before launch — see the Supabase
 * sketch in the README.
 */

export type StoredSubscription = BillingSubscription & {
  /** Your own user id, not Stripe's. */
  userId: string;
};

export interface BillingStore {
  getStripeCustomerId(userId: string): Promise<string | null>;
  saveStripeCustomerId(userId: string, customerId: string): Promise<void>;
  getSubscriptionByUserId(userId: string): Promise<StoredSubscription | null>;
  /** Called by the webhook. Must be idempotent: Stripe retries deliveries. */
  upsertSubscription(subscription: StoredSubscription): Promise<void>;
  /** Called when Stripe reports the subscription is gone for good. */
  removeSubscription(subscriptionId: string): Promise<void>;
}

/**
 * Held on `globalThis` because Next.js bundles route handlers and server
 * components separately: a plain module-level `Map` would give the webhook and
 * the settings page two different stores. A database-backed store does not need
 * this.
 */
const memory = ((globalThis as typeof globalThis & {
  __billingMemory?: {
    customerIdsByUser: Map<string, string>;
    subscriptionsByUser: Map<string, StoredSubscription>;
  };
}).__billingMemory ??= {
  customerIdsByUser: new Map(),
  subscriptionsByUser: new Map(),
});

const { customerIdsByUser, subscriptionsByUser } = memory;

export const inMemoryBillingStore: BillingStore = {
  async getStripeCustomerId(userId) {
    return customerIdsByUser.get(userId) ?? null;
  },

  async saveStripeCustomerId(userId, customerId) {
    customerIdsByUser.set(userId, customerId);
  },

  async getSubscriptionByUserId(userId) {
    return subscriptionsByUser.get(userId) ?? null;
  },

  async upsertSubscription(subscription) {
    subscriptionsByUser.set(subscription.userId, subscription);

    if (subscription.customerId) {
      customerIdsByUser.set(subscription.userId, subscription.customerId);
    }
  },

  async removeSubscription(subscriptionId) {
    for (const [userId, stored] of subscriptionsByUser) {
      if (stored.subscriptionId === subscriptionId) {
        subscriptionsByUser.delete(userId);
      }
    }
  },
};

/** Swap this for a database-backed store when the project has one. */
export const billingStore: BillingStore = inMemoryBillingStore;
