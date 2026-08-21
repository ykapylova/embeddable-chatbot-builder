import type { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonOk } from "server/http/json-api";
import { subscriptionRepository } from "server/repositories/subscription.repository";
import { getPlanUsage } from "server/services/plan.service";

export const runtime = "nodejs";

/**
 * The one place `usePlan()` reads from. Until this resolves the client must
 * show skeletons, not "Free" — a paying account must never see a blocked
 * interface flash on sign-in (PROJECT_SPEC.md §10.5).
 *
 * The `billing` block is composed here rather than in `getPlanUsage` itself:
 * T12 (this billing page) reads `subscriptions` for renewal date and
 * payment-failed status, but `server/services/plan.service.ts` is T11's
 * territory and stays untouched — see the PR description for T12.
 */
export async function GET(): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const [usage, subscription] = await Promise.all([
    getPlanUsage(result.account.id, result.account.plan),
    subscriptionRepository.findByAccount(result.account.id),
  ]);

  return jsonOk({
    ...usage,
    billing: {
      hasBillingHistory: Boolean(subscription?.stripeCustomerId),
      interval: subscription?.billingInterval ?? null,
      renewsOn: subscription?.currentPeriodEnd ? subscription.currentPeriodEnd.slice(0, 10) : null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      paymentFailed: subscription?.paymentFailed ?? false,
    },
  });
}
