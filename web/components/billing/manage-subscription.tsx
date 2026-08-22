"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { ApiError, createPortalSession } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import { usePlan } from "components/plan/use-plan";
import { Button } from "components/ui/button";

/**
 * Upgrade/downgrade between paid plans, cancel, reactivate and change card
 * all happen in the Billing Portal — our code covers first purchase only
 * (PROJECT_SPEC.md §10.6). The button only shows once the account has gone
 * through Checkout at least once: a customer id-less account 500s the
 * Portal call, per PROJECT_SPEC.md §10.8 #12.
 */
export function ManageSubscription() {
  const { plan } = usePlan();

  const portal = useMutation({
    mutationFn: () => createPortalSession(),
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  if (!plan || !plan.billing.hasBillingHistory) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" disabled={portal.isPending} onClick={() => portal.mutate()}>
        {portal.isPending ? "Opening…" : "Manage subscription"}
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>

      {plan.plan !== "free" && !plan.billing.cancelAtPeriodEnd ? (
        <Link href={appPaths.billing() + "?view=cancel"} className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]">
          Cancel subscription
        </Link>
      ) : null}

      {portal.isError ? (
        <p className="w-full text-sm text-[var(--danger)]">
          {portal.error instanceof ApiError ? portal.error.message : "Could not open the billing portal"}
        </p>
      ) : null}
    </div>
  );
}
