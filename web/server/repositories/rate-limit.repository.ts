import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb } from "server/db/client";
import { widgetGenerationSlotsTable, widgetRateLimitsTable } from "server/db/schema";

/** One dimension of a limit: the key it counts against and its ceiling. */
export type CounterSpec = { key: string; limit: number };

/**
 * Hits recorded for each dimension, in the order they were passed. `null` means
 * the dimension was never touched because an earlier one had already tripped.
 */
export type CounterHits = [number, number | null, number | null];

export type SlotClaim = { botId: string; slotNo: number; token: string };

/** Rows are only read through their key, so an expired one is dead weight. */
const SWEEP_PROBABILITY = 0.02;

type HitsRow = { h0: number; h1: number | null; h2: number | null };

/**
 * Increment one counter in place: a first hit in a new window resets the row
 * rather than inserting a second one, so a key occupies exactly one row for as
 * long as it is being used.
 */
function increment(key: string, windowMs: number, gate?: { onHits: string; below: number }) {
  const window = sql`(now() + ${`${Math.round(windowMs / 1000)} seconds`}::interval)`;
  const values = gate
    ? sql`SELECT ${key}, 1, ${window} WHERE (SELECT hits FROM ${sql.raw(gate.onHits)}) <= ${gate.below}`
    : sql`VALUES (${key}, 1, ${window})`;

  return sql`
    INSERT INTO ${widgetRateLimitsTable} AS r (key, hits, expires_at)
    ${values}
    ON CONFLICT (key) DO UPDATE
      SET hits = CASE WHEN r.expires_at <= now() THEN 1 ELSE r.hits + 1 END,
          expires_at = CASE WHEN r.expires_at <= now() THEN ${window} ELSE r.expires_at END
    RETURNING hits
  `;
}

export const rateLimitRepository = {
  /**
   * Counts one request against three dimensions in a single round trip, and
   * stops at the first one that trips.
   *
   * Stopping matters as much as counting: if a visitor who is already being
   * refused kept incrementing the bot's counter, one attacker could push a bot
   * past its own ceiling and have every other visitor refused with `BOT_BUSY`.
   * The gate is a `WHERE` on the next dimension's insert, so the whole decision
   * is still one statement — chained data-modifying CTEs execute in the order
   * they reference each other.
   */
  async consume(
    dimensions: [CounterSpec, CounterSpec, CounterSpec],
    windowMs: number,
  ): Promise<CounterHits> {
    const [first, second, third] = dimensions;
    const db = getDb();

    const result = await db.execute<HitsRow>(sql`
      WITH d0 AS (${increment(first.key, windowMs)}),
           d1 AS (${increment(second.key, windowMs, { onHits: "d0", below: first.limit })}),
           d2 AS (${increment(third.key, windowMs, { onHits: "d1", below: second.limit })})
      SELECT (SELECT hits FROM d0) AS h0,
             (SELECT hits FROM d1) AS h1,
             (SELECT hits FROM d2) AS h2
    `);

    const row = result.rows[0];
    return [row?.h0 ?? 1, row?.h1 ?? null, row?.h2 ?? null];
  },

  /**
   * Claims a numbered generation slot for a bot, or reports that all of them
   * are taken.
   *
   * The free slot is picked at random rather than lowest-first: two instances
   * racing would otherwise always pick the same number, and the loser would be
   * told the bot is busy while other slots stood empty. The unique index still
   * decides the genuine tie — the `WHERE` on the conflict path refuses to steal
   * a slot that someone else has just refreshed.
   */
  async claimSlot(botId: string, maxSlots: number, ttlMs: number): Promise<SlotClaim | null> {
    const db = getDb();
    const token = randomUUID();
    const expiry = sql`(now() + ${`${Math.round(ttlMs / 1000)} seconds`}::interval)`;

    const result = await db.execute<{ slot_no: number }>(sql`
      WITH free AS (
        SELECT g.n
        FROM generate_series(0, ${maxSlots - 1}) AS g(n)
        LEFT JOIN ${widgetGenerationSlotsTable} s
          ON s.bot_id = ${botId} AND s.slot_no = g.n AND s.expires_at > now()
        WHERE s.slot_no IS NULL
        ORDER BY random()
        LIMIT 1
      )
      INSERT INTO ${widgetGenerationSlotsTable} AS w (bot_id, slot_no, token, expires_at)
      SELECT ${botId}, free.n, ${token}, ${expiry} FROM free
      ON CONFLICT (bot_id, slot_no) DO UPDATE
        SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
        WHERE w.expires_at <= now()
      RETURNING slot_no
    `);

    const row = result.rows[0];
    return row ? { botId, slotNo: row.slot_no, token } : null;
  },

  /** Gives a slot back. The token check keeps a late release from freeing someone else's slot. */
  async releaseSlot(claim: SlotClaim): Promise<void> {
    const db = getDb();
    await db.execute(sql`
      DELETE FROM ${widgetGenerationSlotsTable}
      WHERE bot_id = ${claim.botId} AND slot_no = ${claim.slotNo} AND token = ${claim.token}
    `);
  },

  /**
   * Drops rows nobody will read again. Called on a fraction of requests rather
   * than on a schedule: the table is small, and a cron job for it would be one
   * more thing to configure per deployment.
   */
  async sweepExpired(): Promise<void> {
    if (Math.random() > SWEEP_PROBABILITY) return;
    const db = getDb();
    await db.execute(sql`
      DELETE FROM ${widgetRateLimitsTable} WHERE expires_at <= now() - interval '5 minutes'
    `);
  },
};
