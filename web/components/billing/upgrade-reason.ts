import type { PlanLimitCode } from "lib/api-types/plan";

/**
 * `PlanLimitCode` covers every 402 the server can throw. Two of the six
 * triggers in PROJECT_SPEC.md §10.3 never reach the server as an error —
 * the credit warning is a proactive banner, and the gaps list is rendered
 * locked rather than blocked — so they get their own client-only reasons.
 */
export type UpgradeReason = PlanLimitCode | "GAPS_LOCKED";

function isUpgradeReason(value: string): value is UpgradeReason {
  return value in REASON_COPY;
}

export function parseUpgradeReason(value: string | null): UpgradeReason | null {
  if (!value) return null;
  return isUpgradeReason(value) ? value : null;
}

export const REASON_COPY: Record<UpgradeReason, { title: string; body: string }> = {
  LIMIT_CREDITS: {
    title: "You're close to your credit limit",
    body: "Once this period's credits run out your bot switches to contact-collection mode. Upgrade for a bigger monthly allowance.",
  },
  LIMIT_BOTS: {
    title: "You've reached your bot limit",
    body: "A second bot means a second product or site to support. Upgrade for more bots on your account.",
  },
  LIMIT_SOURCES: {
    title: "You've reached this bot's source limit",
    body: "Upgrade for more sources per bot.",
  },
  LIMIT_CHARS: {
    title: "This bot's knowledge base is full",
    body: "Upgrade for more room to grow your knowledge base.",
  },
  LIMIT_DOMAINS: {
    title: "You've reached your domain limit",
    body: "One domain covers a real start; upgrade to embed the widget on more sites.",
  },
  FEATURE_LEADS: {
    title: "A customer's contact could have been here",
    body: "When your bot can't answer, Pro and Business plans collect the visitor's contact info instead of letting them leave empty-handed.",
  },
  FEATURE_EXPORT: {
    title: "CSV export is a Pro feature",
    body: "Upgrade to export your leads as CSV.",
  },
  FEATURE_BRANDING: {
    title: 'Remove the "Powered by" badge',
    body: "Upgrade to Pro to show the widget without our branding.",
  },
  GAPS_LOCKED: {
    title: "See what your bot can't answer",
    body: "Upgrade to Pro to see the full, grouped list of unanswered questions instead of just the counter.",
  },
};
