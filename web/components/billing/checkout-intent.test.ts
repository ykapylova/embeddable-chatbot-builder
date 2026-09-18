import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCheckoutIntent } from "./checkout-intent";

describe("parseCheckoutIntent", () => {
  it("accepts a paid plan with its interval", () => {
    assert.deepEqual(parseCheckoutIntent("business", "year"), { plan: "business", interval: "year" });
  });

  it("defaults a missing or unknown interval to monthly", () => {
    assert.deepEqual(parseCheckoutIntent("pro", null), { plan: "pro", interval: "month" });
    assert.deepEqual(parseCheckoutIntent("pro", "weekly"), { plan: "pro", interval: "month" });
  });

  it("ignores the free plan and anything unknown", () => {
    assert.equal(parseCheckoutIntent("free", "month"), null);
    assert.equal(parseCheckoutIntent("enterprise", "month"), null);
    assert.equal(parseCheckoutIntent(null, "year"), null);
  });
});
