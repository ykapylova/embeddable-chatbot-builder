import type { SubscriptionPatch } from "server/repositories/subscription.repository";

/**
 * The one shape for "this account is back on Free". Both routes there go
 * through it — `customer.subscription.deleted` and the grace sweep.
 *
 * Clearing the billing period is the part that is easy to forget and expensive
 * to miss. `resolvePeriodStart` in `plan.service.ts` prefers
 * `current_period_start` whenever it is set, so a row that keeps the last paid
 * period after dropping to Free pins that account's credit window to a date
 * that will never advance again: the free allowance is spent once and never
 * refills. Nulling the period is what hands the account back to the rolling
 * monthly anchor a Free account is supposed to use.
 *
 * `extra` is spread first on purpose — a caller adds what only it knows (the
 * Stripe status, whether the subscription id survives) and cannot weaken the
 * invariant this function exists to hold.
 */
export function freeDowngradePatch(extra: SubscriptionPatch = {}): SubscriptionPatch {
  return {
    ...extra,
    plan: "free",
    paymentFailed: false,
    graceUntil: null,
    billingInterval: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  };
}
