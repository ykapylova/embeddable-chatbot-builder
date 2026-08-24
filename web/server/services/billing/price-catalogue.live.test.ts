import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PLAN_CATALOGUE, type BillingInterval } from "lib/plans";
import { env } from "server/env";
import { getStripeClient } from "server/services/billing/stripe-client";

import { resolvePriceId, type PurchasablePlan } from "./price-catalogue";

/**
 * Nothing else connects the price the app advertises to the price Stripe will
 * actually charge. `lib/plans.ts` renders the pricing table and `STRIPE_PRICE_*`
 * decides the amount at Checkout, and the two are joined only by whoever typed
 * the price id into the environment — a Pro price created at the wrong amount in
 * the dashboard shows $29 on the landing page and charges something else, with
 * no error anywhere.
 *
 * Needs a live Stripe key, so `npm test` skips it and `npm run test:live` runs it.
 */
const hasStripe = Boolean(env.stripeSecretKey);

const INTERVALS: BillingInterval[] = ["month", "year"];

describe("Stripe prices match the plan catalogue", { skip: hasStripe ? false : "no STRIPE_SECRET_KEY" }, () => {
  for (const plan of PLAN_CATALOGUE) {
    if (plan.id === "free") continue;

    for (const interval of INTERVALS) {
      const expectedDollars = interval === "month" ? plan.monthlyPrice : plan.yearlyPrice;

      it(`${plan.id}/${interval} costs $${expectedDollars}`, async (t) => {
        let priceId: string;
        try {
          priceId = resolvePriceId(plan.id as PurchasablePlan, interval);
        } catch {
          t.skip(`no price id configured for ${plan.id}/${interval}`);
          return;
        }

        const price = await getStripeClient().prices.retrieve(priceId);

        assert.equal(
          price.unit_amount,
          expectedDollars * 100,
          `${priceId} charges ${price.unit_amount} cents, the catalogue advertises ${expectedDollars * 100}`,
        );
        assert.equal(price.recurring?.interval, interval);
        assert.equal(price.active, true, `${priceId} is archived in Stripe`);
      });
    }
  }
});
