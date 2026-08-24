import { accountRepository, type AccountRow } from "server/repositories/account.repository";
import { subscriptionRepository } from "server/repositories/subscription.repository";
import { getStripeClient } from "server/services/billing/stripe-client";
import {
  endedSubscriptionPatch,
  subscriptionPatchFrom,
} from "server/services/billing/subscription-patch";

/** Statuses Stripe will not move off on its own — the subscription is over. */
const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);

/**
 * Reconciles our row with Stripe on the way back from the Billing Portal.
 *
 * Cancel, resume, plan change and card updates all happen inside the Portal,
 * and the redirect back carries nothing that says which of them occurred. Until
 * this existed the only writer of `cancel_at_period_end` was the webhook, so a
 * cancellation left `/billing` still promising "Renews <date>" — for as long as
 * the webhook took, or forever on an environment where it is not configured.
 *
 * Read-only against Stripe and idempotent, so calling it on every return from
 * the Portal is safe whether or not anything actually changed.
 */
export async function syncSubscriptionFromStripe(account: AccountRow): Promise<void> {
  const existing = await subscriptionRepository.findByAccount(account.id);
  if (!existing?.stripeCustomerId) return;

  const { data } = await getStripeClient().subscriptions.list({
    customer: existing.stripeCustomerId,
    status: "all",
    limit: 1,
  });

  const subscription = data[0];
  if (!subscription) return;

  const ended = ENDED_STATUSES.has(subscription.status);
  const patch = ended ? endedSubscriptionPatch(subscription) : subscriptionPatchFrom(subscription);

  await subscriptionRepository.upsert(account.id, patch);

  const plan = ended ? "free" : patch.plan;
  if (plan) {
    await accountRepository.updatePlan(account.id, plan);
  }
}
