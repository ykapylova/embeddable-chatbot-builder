import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  checkRateLimit,
  MAX_CONCURRENT_GENERATIONS_PER_BOT,
  RATE_LIMITS,
  releaseGeneration,
  releaseGenerationSlot,
  reserveGeneration,
  resetRateLimitState,
} from "./rate-limit";

/**
 * The policy, over the in-memory store. That the same policy is shared between
 * instances is a property of the Postgres store and is tested against the real
 * database in `server/testing/rate-limit.live.test.ts`.
 */

function scope(overrides: Partial<{ visitorId: string; ip: string; botId: string }> = {}) {
  return { visitorId: "visitor-1", ip: "1.1.1.1", botId: "bot-1", ...overrides };
}

beforeEach(() => resetRateLimitState());

describe("checkRateLimit", () => {
  it("allows requests under the per-visitor limit", async () => {
    const s = scope();
    for (let i = 0; i < RATE_LIMITS.chat.visitor; i++) {
      assert.equal((await checkRateLimit("chat", s)).allowed, true, `request ${i} should be allowed`);
    }
  });

  it("names the dimension that tripped, so the refusal can be logged", async () => {
    const s = scope();
    for (let i = 0; i < RATE_LIMITS.chat.visitor; i++) await checkRateLimit("chat", s);
    const result = await checkRateLimit("chat", s);
    assert.deepEqual(result, { allowed: false, dimension: "visitor" });
  });

  it("trips on ip once visitors rotate but the address does not", async () => {
    for (let i = 0; i < RATE_LIMITS.chat.ip; i++) {
      await checkRateLimit("chat", scope({ visitorId: `v-${i}` }));
    }
    const result = await checkRateLimit("chat", scope({ visitorId: "v-last" }));
    assert.deepEqual(result, { allowed: false, dimension: "ip" });
  });

  it("tracks visitors independently", async () => {
    const a = scope({ visitorId: "a", ip: "1.1.1.1" });
    const b = scope({ visitorId: "b", ip: "2.2.2.2" });

    for (let i = 0; i < RATE_LIMITS.chat.visitor; i++) await checkRateLimit("chat", a);
    assert.equal((await checkRateLimit("chat", a)).allowed, false);
    assert.equal((await checkRateLimit("chat", b)).allowed, true);
  });

  it("stops counting a refused request against the wider dimensions", async () => {
    // One visitor hammering must not be able to exhaust the bot's own budget
    // and have every other visitor refused with it.
    const attacker = scope({ visitorId: "attacker" });
    for (let i = 0; i < RATE_LIMITS.chat.bot * 2; i++) await checkRateLimit("chat", attacker);

    const bystander = scope({ visitorId: "bystander", ip: "9.9.9.9" });
    assert.equal((await checkRateLimit("chat", bystander)).allowed, true);
  });

  it("keeps a route's budget out of another route's", async () => {
    const s = scope();
    for (let i = 0; i < RATE_LIMITS.lead.visitor; i++) {
      assert.equal((await checkRateLimit("lead", s)).allowed, true);
    }
    assert.equal((await checkRateLimit("lead", s)).allowed, false);
    // Leaving a lead must not cost the visitor their ability to keep chatting.
    assert.equal((await checkRateLimit("chat", s)).allowed, true);
  });

  it("holds leads to a much lower ceiling than chat", () => {
    assert.ok(RATE_LIMITS.lead.visitor < RATE_LIMITS.chat.visitor);
    assert.ok(RATE_LIMITS.lead.ip < RATE_LIMITS.chat.ip);
  });
});

describe("generation slots", () => {
  it("caps concurrent generations per bot", async () => {
    for (let i = 0; i < MAX_CONCURRENT_GENERATIONS_PER_BOT; i++) {
      assert.ok(await reserveGeneration("bot-1"), `slot ${i}`);
    }
    assert.equal(await reserveGeneration("bot-1"), null);
    // A busy bot must not make every other bot busy too.
    assert.ok(await reserveGeneration("bot-2"));
  });

  it("gives the slot back once the response stream ends", async () => {
    let last = null;
    for (let i = 0; i < MAX_CONCURRENT_GENERATIONS_PER_BOT; i++) last = await reserveGeneration("bot-1");
    assert.equal(await reserveGeneration("bot-1"), null);
    assert.ok(last);

    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: {}\n\n"));
        controller.close();
      },
    });

    for await (const _ of releaseGeneration(last, source) as unknown as AsyncIterable<Uint8Array>) {
      // drain
    }

    assert.ok(await reserveGeneration("bot-1"));
  });

  it("gives the slot back when the visitor cancels mid-stream", async () => {
    const slot = await reserveGeneration("bot-3");
    assert.ok(slot);
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: {}\n\n"));
      },
    });

    const wrapped = releaseGeneration(slot, source);
    const reader = wrapped.getReader();
    await reader.read();
    await reader.cancel("visitor left");

    for (let i = 0; i < MAX_CONCURRENT_GENERATIONS_PER_BOT; i++) {
      assert.ok(await reserveGeneration("bot-3"), `slot ${i} should be free again`);
    }
  });

  it("ignores a release for a slot that has already been handed on", async () => {
    const slot = await reserveGeneration("bot-4");
    assert.ok(slot);
    await releaseGenerationSlot(slot);

    const reclaimed = await reserveGeneration("bot-4");
    assert.ok(reclaimed);
    // The first route releasing late must not free the generation now running.
    await releaseGenerationSlot(slot);

    for (let i = 1; i < MAX_CONCURRENT_GENERATIONS_PER_BOT; i++) {
      assert.ok(await reserveGeneration("bot-4"), `slot ${i}`);
    }
    assert.equal(await reserveGeneration("bot-4"), null);
  });
});
