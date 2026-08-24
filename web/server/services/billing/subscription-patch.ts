import type Stripe from "stripe";

import type { SubscriptionPatch } from "server/repositories/subscription.repository";
import { freeDowngradePatch } from "server/services/billing/free-downgrade";
import { planForPriceId } from "server/services/billing/price-catalogue";

export function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * "Make our row match Stripe's", as one function. The webhook and the
 * after-Portal reconciliation both need it: cancelling happens in the Portal,
 * and if the only writer of `cancel_at_period_end` is a webhook that may not
 * be configured, the billing page keeps promising a renewal that is not coming.
 */
export function subscriptionPatchFrom(subscription: Stripe.Subscription): SubscriptionPatch {
  const customerId = customerIdOf(subscription.customer);

  const patch: SubscriptionPatch = {
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
  if (customerId) patch.stripeCustomerId = customerId;

  // API version 2025-xx moved the billing period onto the subscription item.
  const item = subscription.items.data[0];
  if (!item) return patch;

  patch.currentPeriodStart = new Date(item.current_period_start * 1000).toISOString();
  patch.currentPeriodEnd = new Date(item.current_period_end * 1000).toISOString();

  const resolved = planForPriceId(item.price.id);
  if (resolved) {
    patch.plan = resolved.plan;
    patch.billingInterval = resolved.interval;
  } else {
    // An old price, or a subscription created by hand in the dashboard — never
    // silently drop a paying customer to Free. PROJECT_SPEC.md §10.7.
    console.error(
      `[stripe] unknown price_id ${item.price.id} on ${subscription.id} — keeping current plan`,
    );
  }

  return patch;
}

/** A subscription Stripe has finished with leaves the account on Free. */
export function endedSubscriptionPatch(subscription: Stripe.Subscription): SubscriptionPatch {
  return freeDowngradePatch({
    stripeSubscriptionId: null,
    status: subscription.status,
    cancelAtPeriodEnd: false,
  });
}
