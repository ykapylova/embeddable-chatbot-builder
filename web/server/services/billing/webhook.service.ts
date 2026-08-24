import type Stripe from "stripe";

import { getDb } from "server/db/client";
import { accountRepository } from "server/repositories/account.repository";
import { stripeEventRepository } from "server/repositories/stripe-event.repository";
import { subscriptionRepository } from "server/repositories/subscription.repository";
import { getStripeClient, getStripeWebhookSecret } from "server/services/billing/stripe-client";
import {
  customerIdOf,
  endedSubscriptionPatch,
  subscriptionPatchFrom,
} from "server/services/billing/subscription-patch";

const GRACE_DAYS = 7;

export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  return getStripeClient().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
}

type Executor = Pick<ReturnType<typeof getDb>, "insert" | "select" | "update">;

/**
 * Webhooks became the only channel through which we learn about plan changes
 * once upgrade/downgrade/cancel moved into the Billing Portal — PROJECT_SPEC.md
 * §10.7. Resolving by `stripe_customer_id` from our own database (not by
 * searching metadata) is rule 3 there; the `created` event is the one
 * exception, since our database has no row yet the first time it fires.
 */
async function resolveAccountId(tx: Executor, customerId: string, clerkUserId?: string): Promise<string> {
  const bySubscription = await subscriptionRepository.findByStripeCustomerId(customerId, tx);
  if (bySubscription) return bySubscription.accountId;

  if (clerkUserId) {
    const account = await accountRepository.findByClerkUserId(clerkUserId, tx);
    if (account) return account.id;
  }

  throw new Error(`Could not resolve an account for Stripe customer ${customerId}`);
}

async function handleCheckoutCompleted(tx: Executor, session: Stripe.Checkout.Session): Promise<void> {
  const clerkUserId = session.metadata?.clerkUserId;
  if (!clerkUserId) throw new Error("checkout.session.completed has no metadata.clerkUserId");

  const account = await accountRepository.findByClerkUserId(clerkUserId, tx);
  if (!account) throw new Error(`No account for Clerk user ${clerkUserId}`);

  const customerId = customerIdOf(session.customer);
  if (!customerId) throw new Error("checkout.session.completed has no customer");

  await subscriptionRepository.upsert(account.id, { stripeCustomerId: customerId }, tx);
}

/** Shared by `created` and `updated`: both resolve to "make our row match Stripe's". */
async function handleSubscriptionSync(tx: Executor, subscription: Stripe.Subscription): Promise<void> {
  const customerId = customerIdOf(subscription.customer);
  if (!customerId) throw new Error(`${subscription.id} has no customer`);

  const accountId = await resolveAccountId(tx, customerId, subscription.metadata?.clerkUserId);

  const patch = subscriptionPatchFrom(subscription);
  await subscriptionRepository.upsert(accountId, patch, tx);
  if (patch.plan) {
    await accountRepository.updatePlan(accountId, patch.plan, tx);
  }
}

async function handleSubscriptionDeleted(tx: Executor, subscription: Stripe.Subscription): Promise<void> {
  const customerId = customerIdOf(subscription.customer);
  if (!customerId) throw new Error(`${subscription.id} has no customer`);

  const accountId = await resolveAccountId(tx, customerId, subscription.metadata?.clerkUserId);

  // `stripe_customer_id` stays: it is how `resolveAccountId` and the portal
  // link still find this account, and how `/billing` knows there is history.
  await subscriptionRepository.upsert(accountId, endedSubscriptionPatch(subscription), tx);
  await accountRepository.updatePlan(accountId, "free", tx);
}

async function handlePaymentFailed(tx: Executor, invoice: Stripe.Invoice): Promise<void> {
  const customerId = customerIdOf(invoice.customer);
  if (!customerId) throw new Error("invoice.payment_failed has no customer");

  const subscription = await subscriptionRepository.findByStripeCustomerId(customerId, tx);
  if (!subscription) throw new Error(`No subscription for Stripe customer ${customerId}`);

  const graceUntil = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await subscriptionRepository.upsert(subscription.accountId, { paymentFailed: true, graceUntil }, tx);
}

async function handlePaymentSucceeded(tx: Executor, invoice: Stripe.Invoice): Promise<void> {
  const customerId = customerIdOf(invoice.customer);
  if (!customerId) throw new Error("invoice.payment_succeeded has no customer");

  const subscription = await subscriptionRepository.findByStripeCustomerId(customerId, tx);
  if (!subscription) throw new Error(`No subscription for Stripe customer ${customerId}`);

  // No explicit credit reset: usage_counters is keyed by period_start, and
  // `customer.subscription.updated` (which Stripe fires alongside a renewal
  // invoice) advances current_period_start — the new period starts at 0 by
  // construction. See resolvePeriodStart in plan.service.ts.
  await subscriptionRepository.upsert(subscription.accountId, { paymentFailed: false, graceUntil: null }, tx);
}

/**
 * A failing handler must throw so the caller returns 500 and Stripe retries —
 * PROJECT_SPEC.md §10.7 rule 1. Dedup (rule 2) wraps the whole thing: the
 * marker and the handler's writes commit or roll back together, so a retry
 * after a genuine failure is not mistaken for a redelivery of a handled event.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    const isNew = await stripeEventRepository.markProcessed(event.id, event.type, tx);
    if (!isNew) return;

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(tx, event.data.object as Stripe.Checkout.Session);
        return;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionSync(tx, event.data.object as Stripe.Subscription);
        return;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(tx, event.data.object as Stripe.Subscription);
        return;
      case "invoice.payment_failed":
        await handlePaymentFailed(tx, event.data.object as Stripe.Invoice);
        return;
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(tx, event.data.object as Stripe.Invoice);
        return;
      default:
        return;
    }
  });
}
