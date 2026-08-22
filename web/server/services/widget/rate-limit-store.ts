import { randomUUID } from "node:crypto";

import { rateLimitRepository, type CounterSpec, type SlotClaim } from "server/repositories/rate-limit.repository";
import { env } from "server/env";
import { logFailure } from "server/observability/log";

/**
 * Where the widget's counters live.
 *
 * There are two implementations and the choice is made once, here — never with
 * a branch inside the policy. Postgres is the real one: every instance of the
 * app shares it, which is the whole point of a limit. The in-memory one exists
 * so the unit suite (and any run without `DATABASE_URL`) can exercise the same
 * policy without a database; an app that has no database cannot serve a chat
 * request anyway.
 */
export type GenerationSlot = SlotClaim;

export type RateLimitStore = {
  /**
   * Counts one request against the dimensions in order, stopping at the first
   * that trips. Returns the index of that dimension, or `null` if all passed.
   */
  consume(dimensions: [CounterSpec, CounterSpec, CounterSpec], windowMs: number): Promise<number | null>;
  reserve(botId: string, maxSlots: number, ttlMs: number): Promise<GenerationSlot | null>;
  release(slot: GenerationSlot): Promise<void>;
};

// ─── In memory ──────────────────────────────────────────────────────────────

type Bucket = { hits: number; resetAt: number };

export function createMemoryStore(): RateLimitStore {
  const buckets = new Map<string, Bucket>();
  const slots = new Map<string, Map<number, { token: string; expiresAt: number }>>();

  /** Called on the cold path of every check so the map never grows unbounded. */
  function sweep(now: number): void {
    if (Math.random() > 0.02) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  function hit(spec: CounterSpec, windowMs: number, now: number): boolean {
    const existing = buckets.get(spec.key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(spec.key, { hits: 1, resetAt: now + windowMs });
      return 1 <= spec.limit;
    }
    existing.hits += 1;
    return existing.hits <= spec.limit;
  }

  return {
    async consume(dimensions, windowMs) {
      const now = Date.now();
      sweep(now);
      for (let i = 0; i < dimensions.length; i++) {
        if (!hit(dimensions[i], windowMs, now)) return i;
      }
      return null;
    },

    async reserve(botId, maxSlots, ttlMs) {
      const now = Date.now();
      const held = slots.get(botId) ?? new Map();
      slots.set(botId, held);

      for (const [slotNo, slot] of held) {
        if (slot.expiresAt <= now) held.delete(slotNo);
      }
      for (let slotNo = 0; slotNo < maxSlots; slotNo++) {
        if (held.has(slotNo)) continue;
        const token = randomUUID();
        held.set(slotNo, { token, expiresAt: now + ttlMs });
        return { botId, slotNo, token };
      }
      return null;
    },

    async release(slot) {
      const held = slots.get(slot.botId);
      if (held?.get(slot.slotNo)?.token !== slot.token) return;
      held.delete(slot.slotNo);
      if (held.size === 0) slots.delete(slot.botId);
    },

  };
}

// ─── Shared, in Postgres ────────────────────────────────────────────────────

export function createPostgresStore(): RateLimitStore {
  return {
    async consume(dimensions, windowMs) {
      void rateLimitRepository.sweepExpired().catch((error) => {
        logFailure("widget.rate_limit.sweep_failed", error);
      });

      const hits = await rateLimitRepository.consume(dimensions, windowMs);
      for (let i = 0; i < dimensions.length; i++) {
        const recorded = hits[i];
        // A dimension the statement never reached cannot have tripped: the
        // gate only skips it once an earlier one has already refused.
        if (recorded !== null && recorded > dimensions[i].limit) return i;
      }
      return null;
    },

    reserve: (botId, maxSlots, ttlMs) => rateLimitRepository.claimSlot(botId, maxSlots, ttlMs),
    release: (slot) => rateLimitRepository.releaseSlot(slot),
  };
}

let store: RateLimitStore | undefined;

export function rateLimitStore(): RateLimitStore {
  store ??= env.databaseUrl ? createPostgresStore() : createMemoryStore();
  return store;
}

/** Test seam: the policy suite pins its own store rather than depending on whether a database is configured. */
export function setRateLimitStore(replacement: RateLimitStore): void {
  store = replacement;
}
