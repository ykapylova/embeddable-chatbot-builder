import { z } from "zod";

import type { AccountRow } from "server/repositories/account.repository";
import { subscriptionRepository } from "server/repositories/subscription.repository";
import { safeReturnUrl } from "server/services/billing/return-url";
import { getStripeClient } from "server/services/billing/stripe-client";

export const createPortalSchema = z.object({
  returnUrl: z.string().trim().max(2048).optional(),
});

/** PROJECT_SPEC.md §10.8 #12 — the client must only show the Portal button when this exists. */
export class NoBillingHistoryError extends Error {
  constructor() {
    super("No billing history yet.");
    this.name = "NoBillingHistoryError";
  }
}

/** Every plan change, cancellation and card update after the first purchase happens here — PROJECT_SPEC.md §10.6. */
export async function createPortalSession(account: AccountRow, input: unknown): Promise<string> {
  const { returnUrl } = createPortalSchema.parse(input);

  const subscription = await subscriptionRepository.findByAccount(account.id);
  if (!subscription?.stripeCustomerId) {
    throw new NoBillingHistoryError();
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: safeReturnUrl(returnUrl, "/billing"),
  });

  return session.url;
}
