/**
 * Fixed-window rate limiting, in process memory. There is no shared store
 * (Redis/Upstash) provisioned for this project yet, and adding one is a
 * `package.json` change outside this task's territory — see the PR body.
 * A serverless deployment runs many instances, so this bounds abuse from a
 * single warm instance rather than globally; it is a real guard, not a
 * decorative one, and it costs nothing to upgrade later behind the same
 * `checkRateLimit` call.
 */

const WINDOW_MS = 60_000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Called on the cold path of every check so the map never grows unbounded. */
function sweepExpired(now: number): void {
  if (Math.random() > 0.02) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function hit(key: string, limit: number): boolean {
  const now = Date.now();
  sweepExpired(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

/** Messages per minute, per dimension. Chosen to absorb a real conversation without inviting abuse. */
export const RATE_LIMITS = {
  visitor: 10,
  ip: 30,
  bot: 120,
} as const;

export type RateLimitScope = { visitorId: string; ip: string; botId: string };

/** Checks all three dimensions; the first one to trip decides the response. */
export function checkRateLimit(scope: RateLimitScope): boolean {
  return (
    hit(`visitor:${scope.visitorId}`, RATE_LIMITS.visitor) &&
    hit(`ip:${scope.ip}`, RATE_LIMITS.ip) &&
    hit(`bot:${scope.botId}`, RATE_LIMITS.bot)
  );
}
