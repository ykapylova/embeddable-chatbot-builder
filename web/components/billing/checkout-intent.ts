import type { BillingInterval, PlanId } from "lib/plans";

export type PaidPlanId = Extract<PlanId, "pro" | "business">;

export type CheckoutIntent = { plan: PaidPlanId; interval: BillingInterval };

/**
 * A plan picked on the landing page arrives as `/billing?checkout=pro&interval=year`,
 * possibly after a detour through sign-up. Anything malformed is ignored rather
 * than guessed at: the visitor then simply sees the plan cards.
 */
export function parseCheckoutIntent(checkout: string | null, interval: string | null): CheckoutIntent | null {
  if (checkout !== "pro" && checkout !== "business") return null;
  return { plan: checkout, interval: interval === "year" ? "year" : "month" };
}
