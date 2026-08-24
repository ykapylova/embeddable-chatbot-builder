import type { SubscriptionRow } from "server/repositories/subscription.repository";

/**
 * Statuses under which a Stripe subscription is still "live" — mirrors the
 * set the source document uses to decide when a customer already has a
 * subscription to manage, rather than a new one to create.
 *
 * This lives here rather than next to Checkout because two callers must agree
 * on it: Checkout refuses a live subscriber, and `/api/me/plan` tells the
 * client which of the two paths a plan button should take. When they disagreed
 * the upgrade button sent existing subscribers into Checkout and the refusal
 * came back as a 409 the user could do nothing about.
 */
const LIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

export function hasLiveSubscription(subscription: Pick<SubscriptionRow, "status"> | null): boolean {
  return Boolean(subscription?.status && LIVE_SUBSCRIPTION_STATUSES.has(subscription.status));
}
