"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";

import { ApiError, createCheckoutSession, createPortalSession, getPlanCatalogue } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import type { BillingInterval, PlanId } from "lib/plans";
import { yearlySavingPercent } from "lib/plans";
import { queryKeys } from "lib/query-keys";
import { cn } from "lib/utils";
import { usePlan } from "components/plan/use-plan";
import { REASON_COPY, type UpgradeReason } from "components/billing/upgrade-reason";
import { Button } from "components/ui/button";
import { Card } from "components/ui/card";
import { TagPill } from "components/ui/tag-pill";

type PaidPlanId = Extract<PlanId, "pro" | "business">;

/**
 * Plan cards read entirely from `GET /api/plans` — no price or limit is
 * duplicated here (PROJECT_SPEC.md §10.5). This is also where all six
 * upgrade triggers from §10.3 land, with the reason that brought the
 * visitor highlighted instead of a generic price table.
 */
export function UpgradePlans({ reason }: { reason: UpgradeReason | null }) {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [pendingPlan, setPendingPlan] = useState<PaidPlanId | null>(null);
  const { plan: currentPlan } = usePlan();

  const catalogue = useQuery({ queryKey: queryKeys.billing.plans, queryFn: getPlanCatalogue });

  const checkout = useMutation({
    mutationFn: (input: { plan: PaidPlanId; interval: BillingInterval }) =>
      createCheckoutSession(input.plan, input.interval),
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error) => {
      // The 409 has its own explanation below the cards; anything else would
      // otherwise fail with the button quietly flipping back to "Upgrade".
      if (error instanceof ApiError && error.status === 409) return;
      toast.error(error instanceof Error ? error.message : "Could not start checkout");
    },
  });

  const portal = useMutation({
    mutationFn: (opts?: { flow?: "update" }) => createPortalSession(opts),
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to open billing portal");
    },
  });

  // Checkout is first purchase only — an account Stripe still holds a
  // subscription for can only change plan through the Portal, which is also
  // the only thing that can prorate the switch. Sending it to Checkout is what
  // produced a 409 the visitor could not act on.
  const isSubscriber = currentPlan?.billing.hasLiveSubscription ?? false;

  function handleSelect(planId: PlanId) {
    if (planId === currentPlan?.plan) return;
    if (planId === "free") {
      router.push(`${appPaths.billing()}?view=cancel`);
      return;
    }
    if (isSubscriber) {
      portal.mutate({ flow: "update" });
      return;
    }
    setPendingPlan(planId as PaidPlanId);
    checkout.mutate({ plan: planId as PaidPlanId, interval });
  }

  const isExistingSubscriberError = checkout.error instanceof ApiError && checkout.error.status === 409;

  return (
    <div className="space-y-4">
      {reason ? (
        <div className="rounded-2xl border border-[var(--chip-amber-fg)]/30 bg-[var(--chip-amber-bg)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--chip-amber-fg)]">{REASON_COPY[reason].title}</p>
          <p className="mt-0.5 text-sm text-[var(--chip-amber-fg)]">{REASON_COPY[reason].body}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-1 rounded-full bg-[var(--panel-soft)] p-1">
        <IntervalTab active={interval === "month"} onClick={() => setInterval("month")}>
          Monthly
        </IntervalTab>
        <IntervalTab active={interval === "year"} onClick={() => setInterval("year")}>
          Annual — 2 months free
        </IntervalTab>
      </div>

      {catalogue.isPending ? <PlanCardsSkeleton /> : null}

      {catalogue.isError ? (
        <Card className="border border-[var(--border)] text-center">
          <p className="text-sm text-[var(--danger)]">
            {catalogue.error instanceof Error ? catalogue.error.message : "Could not load plans"}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => catalogue.refetch()}>
            Try again
          </Button>
        </Card>
      ) : null}

      {catalogue.data && catalogue.data.length === 0 ? (
        <Card className="border border-dashed border-[var(--border)] text-center text-sm text-[var(--muted)]">
          No plans available right now.
        </Card>
      ) : null}

      {catalogue.data && catalogue.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {catalogue.data.map((p) => {
            const price = interval === "month" ? p.monthlyPrice : p.yearlyPrice;
            const isCurrent = currentPlan?.plan === p.id;
            const isFree = p.id === "free";
            const saving = yearlySavingPercent(p);
            const isRedirecting = isSubscriber
              ? portal.isPending
              : checkout.isPending && pendingPlan === p.id;

            return (
              <Card
                key={p.id}
                className={cn(
                  "relative flex flex-col border",
                  p.recommended ? "border-[var(--accent)]" : "border-[var(--border)]",
                )}
              >
                {p.recommended ? (
                  <TagPill tone="amber" className="absolute -top-2.5 left-4">
                    Most popular
                  </TagPill>
                ) : null}
                <h3 className="text-base font-semibold">{p.name}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{p.tagline}</p>
                <p className="mt-3 text-2xl font-bold tracking-tight">
                  {price === 0 ? "Free" : `$${price}`}
                  {price > 0 ? (
                    <span className="text-xs font-medium text-[var(--muted)]">
                      {" "}
                      /{interval === "month" ? "mo" : "yr"}
                    </span>
                  ) : null}
                </p>
                {interval === "year" && saving > 0 ? (
                  <p className="text-xs text-[var(--muted)]">Save {saving}% vs monthly</p>
                ) : null}

                <ul className="mt-4 flex-1 space-y-2">
                  {p.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-4"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || isRedirecting}
                  onClick={() => handleSelect(p.id)}
                >
                  {isCurrent
                    ? "Current plan"
                    : isFree
                      ? "Downgrade"
                      : isRedirecting
                        ? "Redirecting…"
                        : isSubscriber
                          ? "Change plan"
                          : "Upgrade"}
                </Button>
              </Card>
            );
          })}
        </div>
      ) : null}

      {checkout.isError ? (
        isExistingSubscriberError ? (
          <p className="text-center text-sm text-[var(--muted)]">
            You already have an active subscription —{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-[var(--foreground)]"
              onClick={() => portal.mutate({ flow: "update" })}
            >
              manage it from the billing portal
            </button>
            .
          </p>
        ) : (
          <p className="text-center text-sm text-[var(--danger)]">
            {checkout.error instanceof Error ? checkout.error.message : "Could not start checkout"}
          </p>
        )
      ) : null}
    </div>
  );
}

function IntervalTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-xs font-medium transition",
        active ? "bg-[var(--panel)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </button>
  );
}

function PlanCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-72 animate-pulse rounded-3xl bg-[var(--panel-soft)]" />
      ))}
    </div>
  );
}
