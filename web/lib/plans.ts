/**
 * The single plan catalogue. Nothing about pricing or limits may be duplicated
 * anywhere else — not in a component, not in landing copy, not in a service.
 * See PROJECT_SPEC.md §10.
 *
 * Stripe price ids deliberately live only in server env: the client asks for a
 * plan and an interval, and the server resolves the price. So `price_...` never
 * reaches the browser.
 */

export type PlanId = "free" | "pro" | "business";
export type BillingInterval = "month" | "year";
export type ModelId = "gpt-4o-mini" | "gpt-4o";

/** An answer on the cheap model costs 1 credit; the advanced model costs 5. */
export const CREDIT_COST: Record<ModelId, number> = {
  "gpt-4o-mini": 1,
  "gpt-4o": 5,
};

export type PlanLimits = {
  credits: number;
  bots: number;
  chars: number;
  sources: number;
  domains: number;
  models: ModelId[];
  /** true = the "Powered by" badge cannot be removed */
  branding: boolean;
  leads: boolean;
  gaps: "counter" | "full";
  historyDays: number;
  export: boolean;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    credits: 100,
    bots: 1,
    chars: 400_000,
    sources: 5,
    domains: 1,
    models: ["gpt-4o-mini"],
    branding: true,
    leads: false,
    gaps: "counter",
    historyDays: 7,
    export: false,
  },
  pro: {
    credits: 2_000,
    bots: 3,
    chars: 5_000_000,
    sources: 100,
    domains: 5,
    models: ["gpt-4o-mini"],
    branding: false,
    leads: true,
    gaps: "full",
    historyDays: 90,
    export: true,
  },
  business: {
    credits: 10_000,
    bots: 10,
    chars: 20_000_000,
    sources: Number.POSITIVE_INFINITY,
    domains: Number.POSITIVE_INFINITY,
    models: ["gpt-4o-mini", "gpt-4o"],
    branding: false,
    leads: true,
    gaps: "full",
    historyDays: 365,
    export: true,
  },
};

export type PlanPresentation = {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;
  /** Annual billing gives two months free. */
  yearlyPrice: number;
  recommended: boolean;
  features: string[];
};

export const PLAN_CATALOGUE: PlanPresentation[] = [
  {
    id: "free",
    name: "Free",
    tagline: "See whether your docs can answer for you.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    recommended: false,
    features: [
      "100 credits per month",
      "1 bot, 5 sources",
      "Answers grounded in your docs",
      "Embed on 1 domain",
      "“Powered by” badge",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For a product with real support traffic.",
    monthlyPrice: 29,
    yearlyPrice: 290,
    recommended: true,
    features: [
      "2,000 credits per month",
      "3 bots, 5M characters",
      "Lead capture when the bot doesn’t know",
      "Unanswered-questions dashboard",
      "Embed on 5 domains, no badge",
      "90 days of history, CSV export",
    ],
  },
  {
    id: "business",
    name: "Business",
    tagline: "Higher volume and the advanced model.",
    monthlyPrice: 99,
    yearlyPrice: 990,
    recommended: false,
    features: [
      "10,000 credits per month",
      "10 bots, 20M characters",
      "GPT-4o answers (5 credits each)",
      "Unlimited sources and domains",
      "12 months of history",
      "Everything in Pro",
    ],
  },
];

export function planLimits(plan: PlanId): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function creditCost(model: ModelId): number {
  return CREDIT_COST[model];
}

/** Percentage saved by paying yearly, for the pricing toggle. */
export function yearlySavingPercent(plan: PlanPresentation): number {
  if (plan.monthlyPrice === 0) return 0;
  const yearlyAtMonthlyRate = plan.monthlyPrice * 12;
  return Math.round((1 - plan.yearlyPrice / yearlyAtMonthlyRate) * 100);
}
