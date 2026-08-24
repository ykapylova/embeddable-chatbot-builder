import type Stripe from "stripe";

import type { BillingInterval } from "lib/plans";
import { resolvePriceId, type PurchasablePlan } from "server/services/billing/price-catalogue";
import { getStripeClient } from "server/services/billing/stripe-client";

const PLANS: PurchasablePlan[] = ["pro", "business"];
const INTERVALS: BillingInterval[] = ["month", "year"];

/** Marks the configurations this app owns, so it never edits one created by hand. */
const MANAGED_BY = "docsy";

/**
 * A Stripe Portal configuration only offers plan switching if it was created
 * with the products to switch between. The default configuration has none, so
 * an account sent to the Portal to upgrade finds nothing there to upgrade with
 * — the Portal is where every plan change past the first purchase happens, so
 * that is the whole path, not a corner of it.
 *
 * Kept per process rather than re-derived: the id is stable for a given set of
 * prices, and building it costs four price lookups.
 */
let cached: { fingerprint: string; configurationId: string } | null = null;

function fingerprintOf(priceIds: string[]): string {
  return [...priceIds].sort().join(",");
}

function collectPriceIds(): string[] {
  const priceIds: string[] = [];
  for (const plan of PLANS) {
    for (const interval of INTERVALS) {
      try {
        priceIds.push(resolvePriceId(plan, interval));
      } catch {
        // A plan or interval this deployment does not sell — the Portal simply
        // will not offer it.
      }
    }
  }
  return priceIds;
}

async function groupPricesByProduct(
  stripe: Stripe,
  priceIds: string[],
): Promise<Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.Product[]> {
  const byProduct = new Map<string, string[]>();

  for (const priceId of priceIds) {
    const price = await stripe.prices.retrieve(priceId);
    const productId = typeof price.product === "string" ? price.product : price.product.id;
    const prices = byProduct.get(productId) ?? [];
    prices.push(priceId);
    byProduct.set(productId, prices);
  }

  return [...byProduct].map(([product, prices]) => ({ product, prices }));
}

async function findManagedConfiguration(
  stripe: Stripe,
  fingerprint: string,
): Promise<string | null> {
  const { data } = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const match = data.find(
    (configuration) =>
      configuration.metadata?.managed_by === MANAGED_BY &&
      configuration.metadata?.prices === fingerprint,
  );
  return match?.id ?? null;
}

/**
 * Returns the id of a Portal configuration that can switch between our plans,
 * creating it on first use. The price fingerprint is part of the lookup, so
 * changing `STRIPE_PRICE_*` produces a new configuration instead of leaving
 * customers on one that offers prices we no longer sell.
 */
export async function ensurePortalConfiguration(): Promise<string | null> {
  const priceIds = collectPriceIds();
  if (priceIds.length === 0) return null;

  const fingerprint = fingerprintOf(priceIds);
  if (cached?.fingerprint === fingerprint) return cached.configurationId;

  const stripe = getStripeClient();

  const existing = await findManagedConfiguration(stripe, fingerprint);
  if (existing) {
    cached = { fingerprint, configurationId: existing };
    return existing;
  }

  const products = await groupPricesByProduct(stripe, priceIds);

  const configuration = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Manage your Docsy subscription" },
    metadata: { managed_by: MANAGED_BY, prices: fingerprint },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        // An upgrade should bill the difference now rather than at the next
        // renewal; Stripe's own credit note handles the downgrade direction.
        proration_behavior: "create_prorations",
        products,
      },
      // Matches what the cancel screen promises: the plan stays until the end
      // of the period that has already been paid for.
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
  });

  cached = { fingerprint, configurationId: configuration.id };
  return configuration.id;
}
