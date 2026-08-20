import type { ModelId, PlanId } from "lib/plans";

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
