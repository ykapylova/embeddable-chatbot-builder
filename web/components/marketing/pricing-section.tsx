"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { cn } from "lib/utils";
import {
  planLimits,
  yearlySavingPercent,
  type BillingInterval,
  type PlanPresentation,
} from "lib/plans";

export function PricingSection({
  plans,
  signedIn,
}: {
  plans: PlanPresentation[];
  signedIn: boolean;
}) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [questionsPerDay, setQuestionsPerDay] = useState(20);

  const paidPlan = plans.find((plan) => plan.monthlyPrice > 0);
  const savingPercent = paidPlan ? yearlySavingPercent(paidPlan) : 0;

  const creditsNeeded = questionsPerDay * 30;
  const fittingPlan = useMemo(() => {
    return plans.find((plan) => planLimits(plan.id).credits >= creditsNeeded);
  }, [plans, creditsNeeded]);

  return (
    <section id="pricing" className="px-6 py-14">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">Simple pricing, no surprises</h2>
          <p className="mx-auto mt-3 max-w-lg text-[var(--muted)]">
            Every plan includes citations, the honest fallback, and streaming answers — those are
            never gated.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--panel)] p-1">
            <button
              onClick={() => setBillingInterval("month")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                billingInterval === "month" ? "text-white" : "text-[var(--muted)]",
              )}
              style={
                billingInterval === "month"
                  ? { background: "var(--brand-cta)" }
                  : undefined
              }
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("year")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                billingInterval === "year" ? "text-white" : "text-[var(--muted)]",
              )}
              style={
                billingInterval === "year"
                  ? { background: "var(--brand-cta)" }
                  : undefined
              }
            >
              Annual
            </button>
          </div>
          {billingInterval === "year" ? (
            <span className="rounded-full bg-[var(--chip-teal-bg)] px-3 py-1 text-xs font-medium text-[var(--chip-teal-fg)]">
              Save {savingPercent}%
            </span>
          ) : null}
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => {
            const monthlyEquivalent =
              billingInterval === "month" ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12);

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-xl border bg-[var(--panel)] p-6 transition duration-200",
                  plan.recommended
                    ? "glow-ring scale-[1.02] border-transparent"
                    : "border-[var(--border)] hover:-translate-y-1 hover:shadow-lg",
                )}
              >
                {plan.recommended ? (
                  <span
                    className="absolute -top-3 left-6 rounded-full px-3 py-0.5 text-xs font-medium text-white"
                    style={{ background: "linear-gradient(100deg, var(--brand-1), var(--brand-2))" }}
                  >
                    Most popular
                  </span>
                ) : null}

                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{plan.tagline}</p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">${monthlyEquivalent}</span>
                  <span className="text-sm text-[var(--muted)]">/mo</span>
                </div>
                {billingInterval === "year" && plan.monthlyPrice > 0 ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    billed ${plan.yearlyPrice}/year
                  </p>
                ) : null}

                <Link href={signedIn ? "/dashboard" : "/sign-up"} className="mt-6">
                  <Button
                    className={cn("w-full", plan.recommended && "border-0")}
                    variant={plan.recommended ? "default" : "outline"}
                    style={
                      plan.recommended
                        ? { background: "var(--brand-cta)" }
                        : undefined
                    }
                  >
                    {signedIn ? "Go to dashboard" : plan.monthlyPrice === 0 ? "Start free" : "Choose " + plan.name}
                  </Button>
                </Link>

                <ul className="mt-6 space-y-2.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--chip-teal-fg)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-[var(--muted)]">
          1 credit = 1 answer. An answer on GPT-4o costs 5 credits.
        </p>

        <div className="mx-auto mt-10 max-w-md rounded-xl border border-[var(--border)] bg-[var(--brand-soft)] p-6">
          <h3 className="text-sm font-medium">How many questions a day is enough for you?</h3>
          <div className="mt-3 flex items-center gap-3">
            <Input
              type="number"
              min={1}
              value={questionsPerDay}
              onChange={(event) => setQuestionsPerDay(Math.max(1, Number(event.target.value) || 1))}
              className="w-24"
            />
            <span className="text-sm text-[var(--muted)]">questions / day</span>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            ≈ {creditsNeeded.toLocaleString()} credits a month.{" "}
            {fittingPlan ? (
              <>
                The <span className="font-medium text-[var(--foreground)]">{fittingPlan.name}</span>{" "}
                plan covers it.
              </>
            ) : (
              "That's above our largest plan — talk to us."
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
