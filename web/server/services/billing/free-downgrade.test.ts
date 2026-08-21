import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { freeDowngradePatch } from "./free-downgrade";

describe("freeDowngradePatch", () => {
  it("clears the billing period", () => {
    const patch = freeDowngradePatch();

    // The reason this function exists: `resolvePeriodStart` prefers
    // `current_period_start` whenever it is set, so a leftover value freezes a
    // Free account's credit window on the last paid period.
    assert.equal(patch.currentPeriodStart, null);
    assert.equal(patch.currentPeriodEnd, null);
    assert.equal(patch.billingInterval, null);
  });

  it("puts the account on Free and ends any grace window", () => {
    const patch = freeDowngradePatch();

    assert.equal(patch.plan, "free");
    assert.equal(patch.paymentFailed, false);
    assert.equal(patch.graceUntil, null);
  });

  it("carries the caller's own fields through", () => {
    const patch = freeDowngradePatch({
      stripeSubscriptionId: null,
      status: "canceled",
      cancelAtPeriodEnd: false,
    });

    assert.equal(patch.stripeSubscriptionId, null);
    assert.equal(patch.status, "canceled");
    assert.equal(patch.cancelAtPeriodEnd, false);
  });

  it("cannot be talked out of clearing the period", () => {
    const patch = freeDowngradePatch({
      plan: "pro",
      currentPeriodStart: "2026-08-01T00:00:00.000Z",
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    });

    assert.equal(patch.plan, "free");
    assert.equal(patch.currentPeriodStart, null);
    assert.equal(patch.currentPeriodEnd, null);
  });

  it("leaves the Stripe customer id alone", () => {
    // Nulling it would cost the account its portal link, its invoice history
    // and the only way `resolveAccountId` finds it on a later webhook.
    assert.equal("stripeCustomerId" in freeDowngradePatch(), false);
  });
});
