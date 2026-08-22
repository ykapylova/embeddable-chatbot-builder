"use client";

import { AlertTriangle, CalendarClock, CreditCard, Database } from "lucide-react";

import type { AccountPlan } from "lib/api-types/plan";
import { usePlan } from "components/plan/use-plan";
import { Button } from "components/ui/button";
import { Card } from "components/ui/card";
import { StatCard } from "components/ui/stat-card";
import { TagPill } from "components/ui/tag-pill";
import { cn } from "lib/utils";

const PLAN_LABEL: Record<AccountPlan["plan"], string> = { free: "Free", pro: "Pro", business: "Business" };

function formatChars(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Current plan, credits used this period, knowledge base entitlement and
 * renewal date — plus the payment-failed and scheduled-cancellation notices
 * when they apply. Skeletons until the plan resolves: a paying account must
 * never see "Free" flash on load (PROJECT_SPEC.md §10.5).
 */
export function PlanSummary() {
  const { plan, isPlanResolved, isLoading, error, refetch } = usePlan();

  if (error) {
    return (
      <Card className="border border-[var(--border)] text-center">
        <p className="text-sm text-[var(--danger)]">{error}</p>
        <Button variant="outline" className="mt-3" onClick={() => refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  if (isLoading || !isPlanResolved || !plan) {
    return <PlanSummarySkeleton />;
  }

  const creditsPercent = Math.min(100, (plan.credits.used / plan.credits.limit) * 100);
  const creditsOver = plan.credits.used >= plan.credits.limit;

  return (
    <div className="space-y-4">
      {plan.billing.paymentFailed ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Your last payment failed. You keep full access for a 7-day grace period — update your card
            in the billing portal to avoid dropping to Free.
          </span>
        </div>
      ) : null}

      {plan.billing.cancelAtPeriodEnd && plan.billing.renewsOn ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-sm">
          <CalendarClock className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <span>
            Your subscription is cancelled — active until{" "}
            <strong>{formatDate(plan.billing.renewsOn)}</strong>, then your account drops to Free.
          </span>
        </div>
      ) : null}

      <Card className="border border-[var(--border)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">Current plan</p>
            <h2 className="text-xl font-bold tracking-tight">{PLAN_LABEL[plan.plan]}</h2>
          </div>
          {plan.plan !== "free" && plan.billing.renewsOn && !plan.billing.cancelAtPeriodEnd ? (
            <TagPill tone="periwinkle">Renews {formatDate(plan.billing.renewsOn)}</TagPill>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            tone={creditsOver ? "rose" : "amber"}
            label="Credits used this period"
            icon={<CreditCard />}
            value={`${plan.credits.used.toLocaleString()} / ${plan.credits.limit.toLocaleString()}`}
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className={cn("h-full rounded-full", creditsOver ? "bg-[var(--danger)]" : "bg-current")}
                style={{ width: `${creditsPercent}%` }}
              />
            </div>
          </StatCard>

          <StatCard
            tone="periwinkle"
            label="Knowledge base"
            icon={<Database />}
            value={`${formatChars(plan.chars.limit)} chars`}
            unit="per bot"
          />
        </div>
      </Card>
    </div>
  );
}

function PlanSummarySkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-28 animate-pulse rounded-3xl bg-[var(--panel-soft)]" />
    </div>
  );
}
