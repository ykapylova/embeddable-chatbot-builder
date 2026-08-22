import Stripe from "stripe";

import { env } from "server/env";

/**
 * Stripe is optional to run this app — the README says so, and the build
 * deliberately does not require its variables. Without them the billing screens
 * used to answer 500 "Could not start checkout", which reads as a broken
 * product rather than an unfinished setup. This carries that difference to the
 * user.
 */
export class BillingNotConfiguredError extends Error {
  constructor(detail: string) {
    super(`Billing is not configured on this deployment (${detail}).`);
    this.name = "BillingNotConfiguredError";
  }
}

/** Constructed on demand so the build never requires Stripe env vars — PROJECT_SPEC.md §10.6. */
export function getStripeClient(): Stripe {
  const secretKey = env.stripeSecretKey;
  if (!secretKey) {
    throw new BillingNotConfiguredError("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(secretKey);
}

export function getStripeWebhookSecret(): string {
  const secret = env.stripeWebhookSecret;
  if (!secret) {
    throw new BillingNotConfiguredError("STRIPE_WEBHOOK_SECRET is not set");
  }
  return secret;
}
