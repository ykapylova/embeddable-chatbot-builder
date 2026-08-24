"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, X } from "lucide-react";

import { ApiError, createPortalSession } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import { planLimits } from "lib/plans";
import { usePlan } from "components/plan/use-plan";
import { Button } from "components/ui/button";
import { Card } from "components/ui/card";

/**
 * Our screen comes first, then the Portal — cancellation itself is a Portal
 * action, but the reviewer's "honest, not obstructive" bar means naming
 * exactly what is lost before handing the user off. PROJECT_SPEC.md §10.6.
 */
export function CancelSubscriptionScreen() {
  const { plan, isPlanResolved, error, refetch } = usePlan();

  const portal = useMutation({
    mutationFn: () => createPortalSession(),
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  // The back link lives outside the branches: a failed plan load used to return
  // a bare skeleton, leaving this screen with no controls and no way off it.
  if (error) {
    return (
      <Shell>
        <Card className="border border-[var(--border)] text-center">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      </Shell>
    );
  }

  if (!isPlanResolved || !plan) {
    return (
      <Shell>
        <div className="h-56 animate-pulse rounded-3xl bg-[var(--panel-soft)]" aria-hidden />
      </Shell>
    );
  }

  const free = planLimits("free");
  const losses: string[] = [];

  if (plan.credits.limit > free.credits) {
    losses.push(`Credits drop to ${free.credits.toLocaleString()} per month (from ${plan.credits.limit.toLocaleString()}).`);
  }
  if (plan.bots.limit === null || plan.bots.limit > free.bots) {
    losses.push(`Only your first bot stays active — the rest lock, but are not deleted.`);
  }
  if (plan.domains.limit === null || plan.domains.limit > free.domains) {
    losses.push(`Only your first widget domain keeps working.`);
  }
  if (!plan.branding) {
    losses.push(`The "Powered by" badge returns to your widget.`);
  }
  if (plan.leads) {
    losses.push(`Lead capture turns off — a fallback reply no longer collects a visitor's contact info.`);
  }
  if (plan.gaps === "full") {
    losses.push(`The content gaps list locks to a counter only.`);
  }
  if (plan.export) {
    losses.push(`CSV export turns off.`);
  }
  if (plan.historyDays > free.historyDays) {
    losses.push(`Conversation history drops to ${free.historyDays} days (from ${plan.historyDays}).`);
  }
  if (plan.models.length > 1) {
    losses.push(`GPT-4o answers are no longer available.`);
  }

  return (
    <Shell>
      <Card className="border border-[var(--border)]">
        <h1 className="text-lg font-semibold">Cancel your subscription?</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your plan stays active until the end of the current period. After that:
        </p>

        <ul className="mt-4 space-y-2.5">
          {losses.map((loss) => (
            <li key={loss} className="flex items-start gap-2.5 text-sm">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
              {loss}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-[var(--muted)]">
          None of your data is deleted. Reactivating before the period ends restores everything
          instantly, at no extra charge.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="destructive" disabled={portal.isPending} onClick={() => portal.mutate()}>
            {portal.isPending ? "Opening…" : "Continue to cancel"}
          </Button>
          <Link href={appPaths.billing()} className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]">
            Never mind
          </Link>
        </div>

        {portal.isError ? (
          <p className="mt-3 text-sm text-[var(--danger)]">
            {portal.error instanceof ApiError ? portal.error.message : "Could not open the billing portal"}
          </p>
        ) : null}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={appPaths.billing()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to billing
      </Link>
      {children}
    </div>
  );
}
