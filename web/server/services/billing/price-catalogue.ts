import type { BillingInterval, PlanId } from "lib/plans";
import { env } from "server/env";
import { BillingNotConfiguredError } from "server/services/billing/stripe-client";

export type PurchasablePlan = Exclude<PlanId, "free">;

export function resolvePriceId(plan: PurchasablePlan, interval: BillingInterval): string {
  const priceId = env.stripePriceIds[plan][interval];
  if (!priceId) {
    throw new BillingNotConfiguredError(`no price is set for ${plan}/${interval}`);
  }
  return priceId;
}

/**
 * The reverse lookup webhooks need. Returns `null` for a `price_id` outside the
 * catalogue (an old price, a subscription created by hand in the dashboard) —
 * callers must keep the account's current plan rather than treat that as Free,
 * per PROJECT_SPEC.md §10.7.
 */
export function planForPriceId(priceId: string): { plan: PurchasablePlan; interval: BillingInterval } | null {
  const { stripePriceIds } = env;
  for (const plan of Object.keys(stripePriceIds) as PurchasablePlan[]) {
    for (const interval of Object.keys(stripePriceIds[plan]) as BillingInterval[]) {
      if (stripePriceIds[plan][interval] === priceId) {
        return { plan, interval };
      }
    }
  }
  return null;
}
