import Stripe from "stripe";

import { env } from "server/env";

/** Constructed on demand so the build never requires Stripe env vars — PROJECT_SPEC.md §10.6. */
export function getStripeClient(): Stripe {
  const secretKey = env.stripeSecretKey;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secretKey);
}

export function getStripeWebhookSecret(): string {
  const secret = env.stripeWebhookSecret;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return secret;
}
