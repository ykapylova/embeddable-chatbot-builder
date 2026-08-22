import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isMissingCustomerError } from "./checkout.service";

/**
 * A customer id stored in `subscriptions` can stop resolving — deleted in the
 * dashboard, or left behind by a test-data reset. That must fall back to a fresh
 * customer rather than 500 the purchase, so recognising the error precisely is
 * the whole of the decision.
 */
describe("isMissingCustomerError", () => {
  const missingCustomer = {
    type: "StripeInvalidRequestError",
    code: "resource_missing",
    param: "customer",
    message: "No such customer: 'cus_dead'",
  };

  it("recognises a deleted customer", () => {
    assert.equal(isMissingCustomerError(missingCustomer), true);
  });

  it("leaves a missing price alone — that is our configuration, not stale state", () => {
    assert.equal(isMissingCustomerError({ ...missingCustomer, param: "line_items[0][price]" }), false);
  });

  it("ignores other Stripe failures, so a card or API error still surfaces", () => {
    assert.equal(isMissingCustomerError({ ...missingCustomer, type: "StripeAPIError" }), false);
    assert.equal(isMissingCustomerError({ ...missingCustomer, code: "customer_max_subscriptions" }), false);
  });

  it("survives things that are not Stripe errors at all", () => {
    for (const value of [null, undefined, "boom", 42, new Error("boom")]) {
      assert.equal(isMissingCustomerError(value), false);
    }
  });
});
