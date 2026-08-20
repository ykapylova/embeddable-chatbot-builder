import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planForPriceId, resolvePriceId } from "./price-catalogue";

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
});
