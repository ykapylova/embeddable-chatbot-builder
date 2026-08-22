import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { env } from "server/env";

import { planForPriceId, resolvePriceId } from "./price-catalogue";
import { BillingNotConfiguredError } from "./stripe-client";

const configuredProMonthly = env.stripePriceIds.pro.month;

/**
 * "The build must not require Stripe env vars" is a requirement, so it is a
 * test rather than something the build's success merely implies. It has to
 * hold in both directions: `npm test` runs without `.env.local` and
 * `npm run test:live` runs with it, and the suite used to fail in the second
 * case because it assumed the first.
 */
describe("price-catalogue", () => {
  it("planForPriceId returns null for a price outside the catalogue", () => {
    assert.equal(planForPriceId("price_definitely_not_ours"), null);
  });

  it("planForPriceId finds a configured price, when one is configured", () => {
    if (!configuredProMonthly) return;
    assert.deepEqual(planForPriceId(configuredProMonthly), { plan: "pro", interval: "month" });
  });

  it("resolvePriceId fails at call time rather than at import time", () => {
    if (configuredProMonthly) {
      assert.equal(resolvePriceId("pro", "month"), configuredProMonthly);
    } else {
      assert.throws(() => resolvePriceId("pro", "month"));
    }
  });

  // The routes answer 503 with the reason on this type and 500 on anything
  // else, so a plain Error here would be a dead-end "Could not start checkout"
  // on a deployment that has simply not set Stripe up yet.
  it("names the missing configuration rather than failing anonymously", () => {
    assert.throws(
      () => resolvePriceId("business", "year"),
      (error: unknown) =>
        error instanceof BillingNotConfiguredError && /business\/year/.test(error.message),
    );
  });
});
