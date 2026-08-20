import type { SessionStatusOutcome } from "lib/api-types/billing";
import { getStripeClient } from "server/services/billing/stripe-client";

/** Stripe returns to `return_url` even when payment failed — never trust the redirect (PROJECT_SPEC.md §10.6). */
export class SessionOwnerMismatchError extends Error {
  constructor() {
    super("This checkout session does not belong to you.");
    this.name = "SessionOwnerMismatchError";
  }
}

const PAID_STATUSES = new Set(["paid", "no_payment_required"]);

export async function getCheckoutSessionStatus(
  sessionId: string,
  clerkUserId: string,
): Promise<SessionStatusOutcome> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.metadata?.clerkUserId !== clerkUserId) {
    throw new SessionOwnerMismatchError();
  }

  if (session.status === "expired") return "expired";
  if (session.status === "complete" && PAID_STATUSES.has(session.payment_status)) return "succeeded";
  return "incomplete";
}
