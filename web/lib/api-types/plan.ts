import type { BillingInterval, ModelId, PlanId } from "lib/plans";

/**
 * Machine codes a 402 can carry — see PROJECT_SPEC.md §10.5. The UI switches
 * on this, not on the human message, to pick a specific limit screen.
 */
export type PlanLimitCode =
  | "LIMIT_CREDITS"
  | "LIMIT_BOTS"
  | "LIMIT_SOURCES"
  | "LIMIT_CHARS"
  | "LIMIT_DOMAINS"
  | "FEATURE_LEADS"
  | "FEATURE_EXPORT"
  | "FEATURE_BRANDING";

/** `null` means the plan places no cap on this dimension. */
export type PlanLimitValue = number | null;

export type PlanUsage = {
  plan: PlanId;
  /** Date (YYYY-MM-DD) the current credit period started — see PROJECT_SPEC.md §10.4. */
  periodStart: string;
  credits: { used: number; limit: number };
  bots: { used: number; limit: PlanLimitValue };
  sources: { limit: PlanLimitValue };
  chars: { limit: number };
  domains: { limit: PlanLimitValue };
  models: ModelId[];
  branding: boolean;
  leads: boolean;
  gaps: "counter" | "full";
  historyDays: number;
  export: boolean;
};

/**
 * What `GET /api/me/plan` actually returns: `PlanUsage` (T10/T11, unchanged —
 * `server/services/plan.service.ts` is out of T12's territory) plus a
 * `billing` block the route composes from the `subscriptions` table for the
 * billing page. See PROJECT_SPEC.md §10.6.
 */
export type AccountPlan = PlanUsage & {
  billing: {
    /** False for an account that has never gone through Stripe checkout — hides the Portal button. */
    hasBillingHistory: boolean;
    /**
     * True while Stripe still holds a subscription for this account. Checkout
     * refuses these accounts, so a plan change has to go to the Portal — the
     * two buttons must branch on the same fact the server refuses on.
     */
    hasLiveSubscription: boolean;
    interval: BillingInterval | null;
    /** Date (YYYY-MM-DD) the current period ends, or `null` on Free. */
    renewsOn: string | null;
    cancelAtPeriodEnd: boolean;
    paymentFailed: boolean;
  };
};
