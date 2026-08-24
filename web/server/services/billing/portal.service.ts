import { z } from "zod";

import type { AccountRow } from "server/repositories/account.repository";
import { subscriptionRepository } from "server/repositories/subscription.repository";
import { ensurePortalConfiguration } from "server/services/billing/portal-configuration";
import { safeReturnUrl } from "server/services/billing/return-url";
import { getStripeClient } from "server/services/billing/stripe-client";

export const createPortalSchema = z.object({
  returnUrl: z.string().trim().max(2048).optional(),
  /** "update" opens the plan picker directly instead of the Portal's home screen. */
  flow: z.enum(["update"]).optional(),
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
  const { returnUrl, flow } = createPortalSchema.parse(input);

  const subscription = await subscriptionRepository.findByAccount(account.id);
  if (!subscription?.stripeCustomerId) {
    throw new NoBillingHistoryError();
  }

  const stripe = getStripeClient();

  // Cancelling must keep working even if the configuration cannot be built, so
  // a failure here falls back to the account's default Portal rather than
  // taking the only exit away.
  let configuration: string | undefined;
  try {
    configuration = (await ensurePortalConfiguration()) ?? undefined;
  } catch (error) {
    console.error("[createPortalSession] could not resolve a Portal configuration", error);
  }

  // Landing on the Portal's home screen after clicking a specific plan makes
  // the visitor find the plan picker themselves; this drops them straight into
  // it. Only possible once we know which subscription is being changed.
  const updateFlow =
    flow === "update" && subscription.stripeSubscriptionId
      ? {
          type: "subscription_update" as const,
          subscription_update: { subscription: subscription.stripeSubscriptionId },
        }
      : undefined;

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: safeReturnUrl(returnUrl, "/billing"),
    configuration,
    flow_data: updateFlow,
  });

  return session.url;
}
