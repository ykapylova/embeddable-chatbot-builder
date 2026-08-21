import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planForPriceId, resolvePriceId } from "./price-catalogue";
import { BillingNotConfiguredError } from "./stripe-client";

// CI runs without Stripe env vars — this is itself the "build must not require
// them" requirement from the task brief, exercised as a test rather than
// merely asserted by the build succeeding.
describe("price-catalogue without Stripe env vars configured", () => {
  it("planForPriceId returns null instead of matching anything", () => {
    assert.equal(planForPriceId("price_anything"), null);
  });

  it("resolvePriceId throws at call time, not at import time", () => {
    assert.throws(() => resolvePriceId("pro", "month"));
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
