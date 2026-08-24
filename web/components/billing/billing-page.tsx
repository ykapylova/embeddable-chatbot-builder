"use client";

import { useSearchParams } from "next/navigation";

import { CancelSubscriptionScreen } from "components/billing/cancel-subscription-screen";
import { CheckoutCancelled, CheckoutReturn } from "components/billing/checkout-return";
import { ManageSubscription } from "components/billing/manage-subscription";
import { PlanSummary } from "components/billing/plan-summary";
import { PortalReturn } from "components/billing/portal-return";
import { UpgradePlans } from "components/billing/upgrade-plans";
import { parseUpgradeReason } from "components/billing/upgrade-reason";

/**
 * Modal state lives in query parameters, not React state — that is what
 * makes the return from Stripe Checkout work at all (PROJECT_SPEC.md §10.6):
 * the user lands back on `?status=success&session_id=…` and the right
 * screen opens itself, no client-side flow to reconstruct.
 */
export function BillingPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const sessionId = searchParams.get("session_id");
  const view = searchParams.get("view");
  const reason = parseUpgradeReason(searchParams.get("reason"));

  if (view === "cancel") {
    return (
      <div className="mx-auto max-w-5xl px-2 py-6 sm:px-4 sm:py-8">
        <CancelSubscriptionScreen />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-2 py-6 sm:px-4 sm:py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Plan, usage and payment details.</p>
      </div>

      {status === "success" && sessionId ? <CheckoutReturn sessionId={sessionId} /> : null}
      {status === "cancelled" ? <CheckoutCancelled /> : null}
      {searchParams.get("portal") ? <PortalReturn /> : null}

      <div className="space-y-6">
        <PlanSummary />
        <ManageSubscription />
        <UpgradePlans reason={reason} />
      </div>
    </div>
  );
}
