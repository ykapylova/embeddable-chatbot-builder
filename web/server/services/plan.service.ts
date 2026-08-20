import type { PlanLimitCode, PlanLimitValue, PlanUsage } from "lib/api-types/plan";
import { creditCost, planLimits, type ModelId, type PlanId } from "lib/plans";
import { botRepository } from "server/repositories/bot.repository";
import { sourceRepository } from "server/repositories/source.repository";
import { subscriptionRepository } from "server/repositories/subscription.repository";
import { usageRepository } from "server/repositories/usage.repository";

/**
 * The one mechanism gates go through — see CLAUDE.md §9 "No parallel
 * decorators or guards for later." A handler catches this and turns it into
 * `402 Payment Required` with `code` and an upgrade link the client builds
 * from that code.
 */
export class PlanLimitError extends Error {
  readonly code: PlanLimitCode;

  constructor(code: PlanLimitCode, message: string) {
    super(message);
    this.name = "PlanLimitError";
    this.code = code;
  }
}

export type PlanCheck =
  | { type: "bots"; accountId: string; plan: PlanId }
  | { type: "sources"; botId: string; plan: PlanId }
  | { type: "domains"; plan: PlanId; requestedDomainCount: number }
  | { type: "branding"; plan: PlanId }
  | { type: "leads"; plan: PlanId }
  | { type: "export"; plan: PlanId };

function toApiLimit(value: number): PlanLimitValue {
  return Number.isFinite(value) ? value : null;
}

/** Checked before the action, per PROJECT_SPEC.md §10.5. Throws `PlanLimitError` on a blocked action. */
export async function assertPlan(check: PlanCheck): Promise<void> {
  switch (check.type) {
    case "bots": {
      const limit = planLimits(check.plan).bots;
      const count = await botRepository.countByAccount(check.accountId);
      if (count >= limit) {
        throw new PlanLimitError(
          "LIMIT_BOTS",
          `Your plan allows up to ${limit} bot${limit === 1 ? "" : "s"}. Upgrade to create another.`,
        );
      }
      return;
    }

    case "sources": {
      const limits = planLimits(check.plan);
      const sources = await sourceRepository.listByBot(check.botId);

      if (sources.length >= limits.sources) {
        throw new PlanLimitError(
          "LIMIT_SOURCES",
          `Your plan allows up to ${limits.sources} sources per bot. Upgrade for more.`,
        );
      }

      const totalChars = sources.reduce((sum, source) => sum + source.charCount, 0);
      if (totalChars >= limits.chars) {
        throw new PlanLimitError(
          "LIMIT_CHARS",
          `This bot's knowledge base has reached your plan's ${limits.chars.toLocaleString()}-character limit. Upgrade for more room.`,
        );
      }
      return;
    }

    case "domains": {
      const limit = planLimits(check.plan).domains;
      if (check.requestedDomainCount > limit) {
        throw new PlanLimitError(
          "LIMIT_DOMAINS",
          `Your plan allows up to ${limit} widget domain${limit === 1 ? "" : "s"}. Upgrade for more.`,
        );
      }
      return;
    }

    case "branding": {
      if (planLimits(check.plan).branding) {
        throw new PlanLimitError(
          "FEATURE_BRANDING",
          'Removing the "Powered by" badge requires a Pro plan.',
        );
      }
      return;
    }

    case "leads": {
      if (!planLimits(check.plan).leads) {
        throw new PlanLimitError("FEATURE_LEADS", "Lead capture requires a Pro plan.");
      }
      return;
    }

    case "export": {
      if (!planLimits(check.plan).export) {
        throw new PlanLimitError("FEATURE_EXPORT", "CSV export requires a Pro plan.");
      }
      return;
    }
  }
}

/** A paid plan gets 10% of headroom past its stated limit before the widget switches to contact-collection mode. Free does not — PROJECT_SPEC.md §10.4. */
const GRACE_MULTIPLIER = 1.1;

/**
 * Shown in place of an answer once credits are exhausted (Free) or the grace
 * buffer is used up (Pro/Business). Fixed wording from PROJECT_SPEC.md §10.4 —
 * the widget must never go silent.
 */
export const CREDIT_LIMIT_MESSAGE =
  "I can't answer right now — please leave your contact info and we'll follow up.";

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const totalMonthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(totalMonthIndex / 12);
  const monthIndex0 = ((totalMonthIndex % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(year, monthIndex0));
  return new Date(Date.UTC(year, monthIndex0, clampedDay));
}

/**
 * Free accounts have no Stripe subscription to source `period_start` from, so
 * credits roll over on a monthly anniversary of the account's own signup date
 * instead of a shared calendar-month boundary — PROJECT_SPEC.md §10.5 is
 * explicit that this must not be the 1st of the month for everyone at once.
 */
export function rollingPeriodStart(accountCreatedAt: string, now: Date = new Date()): string {
  const anchor = new Date(accountCreatedAt);
  let months =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth());
  let candidate = addMonthsClamped(anchor, months);
  if (candidate.getTime() > now.getTime()) {
    months -= 1;
    candidate = addMonthsClamped(anchor, months);
  }
  return candidate.toISOString().slice(0, 10);
}

/**
 * `subscriptions.current_period_start` is the source of truth once Stripe is
 * wired (T11); until then, and for accounts that stay on Free forever, the
 * rolling anchor is all there is.
 */
async function resolvePeriodStart(accountId: string): Promise<string> {
  const subscription = await subscriptionRepository.findByAccount(accountId);
  if (subscription?.currentPeriodStart) {
    return subscription.currentPeriodStart.slice(0, 10);
  }

  const createdAt = await usageRepository.accountCreatedAt(accountId);
  return rollingPeriodStart(createdAt ?? new Date().toISOString());
}

/**
 * The atomic charge from PROJECT_SPEC.md §10.5, called once an answer is
 * known to cost something (the caller already knows this before the model is
 * ever invoked — see `app/api/bots/:botId/chat` and `app/api/public/chat`).
 * Returns false when the charge would exceed the plan's limit (plus the paid
 * grace buffer): the caller must not call the model and must show
 * `CREDIT_LIMIT_MESSAGE` instead.
 */
export async function chargeForAnswer(accountId: string, plan: PlanId, model: ModelId): Promise<boolean> {
  const cost = creditCost(model);
  const limit = planLimits(plan).credits;
  const graceLimit = plan === "free" ? limit : Math.floor(limit * GRACE_MULTIPLIER);
  const periodStart = await resolvePeriodStart(accountId);
  const result = await usageRepository.chargeCredits(accountId, periodStart, cost, graceLimit);
  return result !== null;
}

/** A model call that was charged for but then failed costs the customer nothing. */
export async function refundForAnswer(accountId: string, model: ModelId): Promise<void> {
  const cost = creditCost(model);
  const periodStart = await resolvePeriodStart(accountId);
  await usageRepository.refundCredits(accountId, periodStart, cost);
}

/** Powers `GET /api/me/plan` — the one source the client reads for limits, usage and gated features. */
export async function getPlanUsage(accountId: string, plan: PlanId): Promise<PlanUsage> {
  const limits = planLimits(plan);
  const periodStart = await resolvePeriodStart(accountId);
  const [usage, botsUsed] = await Promise.all([
    usageRepository.find(accountId, periodStart),
    botRepository.countByAccount(accountId),
  ]);

  return {
    plan,
    periodStart,
    credits: { used: usage?.creditsUsed ?? 0, limit: limits.credits },
    bots: { used: botsUsed, limit: toApiLimit(limits.bots) },
    sources: { limit: toApiLimit(limits.sources) },
    chars: { limit: limits.chars },
    domains: { limit: toApiLimit(limits.domains) },
    models: limits.models,
    branding: limits.branding,
    leads: limits.leads,
    gaps: limits.gaps,
    historyDays: limits.historyDays,
    export: limits.export,
  };
}
