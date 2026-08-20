import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkRateLimit, RATE_LIMITS } from "./rate-limit";

function scope(overrides: Partial<{ visitorId: string; ip: string; botId: string }> = {}) {
  return { visitorId: "visitor-1", ip: "1.1.1.1", botId: "bot-1", ...overrides };
}

describe("checkRateLimit", () => {
  it("allows requests under the per-visitor limit", () => {
    const s = scope({ visitorId: `v-${Math.random()}` });
    for (let i = 0; i < RATE_LIMITS.visitor; i++) {
      assert.equal(checkRateLimit(s), true, `request ${i} should be allowed`);
    }
  });

  it("rejects once the per-visitor limit is exceeded", () => {
    const s = scope({ visitorId: `v-${Math.random()}` });
    for (let i = 0; i < RATE_LIMITS.visitor; i++) checkRateLimit(s);
    assert.equal(checkRateLimit(s), false);
  });

  it("tracks visitors independently", () => {
    const botId = `bot-${Math.random()}`;
    const a = scope({ visitorId: `a-${Math.random()}`, ip: `ip-a-${Math.random()}`, botId });
    const b = scope({ visitorId: `b-${Math.random()}`, ip: `ip-b-${Math.random()}`, botId });

    for (let i = 0; i < RATE_LIMITS.visitor; i++) checkRateLimit(a);
    assert.equal(checkRateLimit(a), false);
    assert.equal(checkRateLimit(b), true);
  });
});
