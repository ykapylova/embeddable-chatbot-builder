import { logFailure } from "server/observability/log";

import {
  createMemoryStore,
  rateLimitStore,
  setRateLimitStore,
  type GenerationSlot,
} from "./rate-limit-store";

/**
 * Fixed-window rate limiting and a per-bot concurrency cap for the public
 * widget endpoints.
 *
 * The counters are shared across instances — they live in Postgres, not in
 * process memory — so "10 messages a minute per visitor" means ten, and not ten
 * per warm lambda. This module owns the policy: which dimensions are counted,
 * in what order, and what the ceilings are. Where the numbers are kept is the
 * store's business (`rate-limit-store.ts`).
 *
 * Every refusal is logged by the caller with its reason code, so a bot under
 * attack is visible in the logs rather than only in its credit balance.
 */

const WINDOW_MS = 60_000;

/**
 * Requests per minute, per dimension, per route.
 *
 * Chat absorbs a real conversation. Lead and feedback are far lower on
 * purpose: a visitor leaves one email per conversation and rates a handful of
 * messages, so anything above these is a script. Both write to screens the
 * customer paid for — the Leads export and the Content Gaps dashboard — and an
 * unlimited endpoint lets a stranger fill either one with junk.
 */
export const RATE_LIMITS = {
  chat: { visitor: 10, ip: 30, bot: 120 },
  lead: { visitor: 3, ip: 10, bot: 60 },
  feedback: { visitor: 20, ip: 60, bot: 240 },
} as const;

export type RateLimitedRoute = keyof typeof RATE_LIMITS;
export type RateLimitScope = { visitorId: string; ip: string; botId: string };
export type RateLimitDimension = "visitor" | "ip" | "bot";
export type RateLimitResult = { allowed: true } | { allowed: false; dimension: RateLimitDimension };

/** Narrowest first: the dimension that trips is the one named in the refusal. */
const DIMENSIONS: readonly RateLimitDimension[] = ["visitor", "ip", "bot"] as const;

/**
 * Checks all three dimensions; the first one to trip decides the response.
 *
 * A refused request stops there and does not count against the wider
 * dimensions — otherwise one hammering visitor would fill the bot's own
 * counter and get every other visitor refused along with them.
 */
export async function checkRateLimit(
  route: RateLimitedRoute,
  scope: RateLimitScope,
): Promise<RateLimitResult> {
  const limits = RATE_LIMITS[route];

  const tripped = await rateLimitStore().consume(
    [
      { key: `${route}:visitor:${scope.visitorId}`, limit: limits.visitor },
      { key: `${route}:ip:${scope.ip}`, limit: limits.ip },
      { key: `${route}:bot:${scope.botId}`, limit: limits.bot },
    ],
    WINDOW_MS,
  );

  if (tripped === null) return { allowed: true };
  return { allowed: false, dimension: DIMENSIONS[tripped] };
}

/**
 * Concurrent generations per bot. Each one is an OpenAI completion we pay for,
 * so the cap is about spend, not load.
 */
export const MAX_CONCURRENT_GENERATIONS_PER_BOT = 8;

/**
 * A slot older than this is assumed leaked — a route that reserved and then
 * threw before the stream was ever read. Comfortably longer than the route's
 * own `maxDuration`, so it can never reclaim a slot that is still generating.
 */
const GENERATION_SLOT_TTL_MS = 180_000;

export type { GenerationSlot };

/** Takes a slot for `botId`, or reports that the bot is already at its cap. */
export function reserveGeneration(botId: string): Promise<GenerationSlot | null> {
  return rateLimitStore().reserve(botId, MAX_CONCURRENT_GENERATIONS_PER_BOT, GENERATION_SLOT_TTL_MS);
}

/**
 * Hands a slot back explicitly. For the path where the route fails after
 * reserving and never gets as far as a stream — without this the slot would sit
 * until its TTL, holding capacity a live request could have used.
 */
export async function releaseGenerationSlot(slot: GenerationSlot): Promise<void> {
  try {
    await rateLimitStore().release(slot);
  } catch (error) {
    // A slot that cannot be released expires on its own; failing the response
    // that was about to be sent would be the worse outcome.
    logFailure("widget.generation_slot.release_failed", error, { botId: slot.botId });
  }
}

/**
 * Gives the slot back when the response is finished — completed, errored or
 * cancelled by the visitor. Wrapping the stream is what makes the release
 * unconditional: the route returns and stops running long before the last
 * token is sent, so there is no `finally` there that could do it.
 */
export function releaseGeneration(
  slot: GenerationSlot,
  stream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    void releaseGenerationSlot(slot);
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          release();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        release();
        controller.error(error);
      }
    },
    cancel(reason) {
      release();
      return reader.cancel(reason);
    },
  });
}

/**
 * Test seam. Installs a fresh in-memory store, so one test does not decide the
 * next one's answers and the policy suite behaves the same whether or not the
 * run has a database. Nothing in the application calls it.
 */
export function resetRateLimitState(): void {
  setRateLimitStore(createMemoryStore());
}
