import type Stripe from "stripe";
import { z } from "zod";

import type { AccountRow } from "server/repositories/account.repository";
import { subscriptionRepository } from "server/repositories/subscription.repository";
import { resolvePriceId } from "server/services/billing/price-catalogue";
import { safeReturnUrl } from "server/services/billing/return-url";
import { getStripeClient } from "server/services/billing/stripe-client";

export const createCheckoutSchema = z.object({
  plan: z.enum(["pro", "business"]),
  interval: z.enum(["month", "year"]),
  returnUrl: z.string().trim().max(2048).optional(),
});

/**
 * Statuses under which a Stripe subscription is still "live" — mirrors the
 * set the source document uses to decide when a customer already has a
 * subscription to manage, rather than a new one to create.
 */
const LIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

/**
 * True when Stripe is telling us the customer id we sent does not exist — it was
 * deleted in the dashboard, or the account's test data was reset out from under
 * a row we still hold. Stored ids therefore cannot be trusted to still resolve,
 * and a stale one must not be the end of someone's attempt to pay.
 */
export function isMissingCustomerError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; param?: unknown; type?: unknown };
  return (
    candidate.type === "StripeInvalidRequestError" &&
    candidate.code === "resource_missing" &&
    candidate.param === "customer"
  );
}

/** PROJECT_SPEC.md §10.8 #4 — an existing payer belongs in the Portal, not a second Checkout session. */
export class ExistingSubscriberError extends Error {
  constructor() {
    super("You already have an active subscription. Manage it from the billing portal.");
    this.name = "ExistingSubscriberError";
  }
}

/** Our code covers first purchase only (Free → Pro/Business) — PROJECT_SPEC.md §10.6. */
export async function createCheckoutSession(account: AccountRow, input: unknown): Promise<string> {
  const { plan, interval, returnUrl } = createCheckoutSchema.parse(input);

  const existing = await subscriptionRepository.findByAccount(account.id);
  if (existing?.status && LIVE_SUBSCRIPTION_STATUSES.has(existing.status)) {
    throw new ExistingSubscriberError();
  }

  const priceId = resolvePriceId(plan, interval);
  const returnBase = safeReturnUrl(returnUrl, "/billing");
  const separator = returnBase.includes("?") ? "&" : "?";

  const stripe = getStripeClient();

  function params(customerId: string | null): Stripe.Checkout.SessionCreateParams {
    return {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : account.email,
      allow_promotion_codes: true,
      success_url: `${returnBase}${separator}status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnBase}${separator}status=cancelled`,
      // Duplicated into subscription_data.metadata: the `customer.subscription.created`
      // webhook only sees the latter, never the session's own metadata.
      metadata: { clerkUserId: account.clerkUserId },
      subscription_data: { metadata: { clerkUserId: account.clerkUserId } },
    };
  }

  const storedCustomerId = existing?.stripeCustomerId ?? null;
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(params(storedCustomerId));
  } catch (error) {
    if (!storedCustomerId || !isMissingCustomerError(error)) throw error;

    // The stored customer is gone on Stripe's side. Reattaching the purchase to
    // that id is impossible, but refusing the purchase is the wrong answer: the
    // row is stale, not the customer's intent. Start them as a new customer —
    // the subscription webhook writes the fresh id back over the dead one.
    console.warn("[createCheckoutSession] stale Stripe customer, starting fresh", storedCustomerId);
    session = await stripe.checkout.sessions.create(params(null));
  }

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL");
  }
  return session.url;
}
