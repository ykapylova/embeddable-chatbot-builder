import { and, eq, sql } from "drizzle-orm";

import { getDb } from "server/db/client";
import { accountsTable, usageCountersTable } from "server/db/schema";

export type UsageCounterRow = typeof usageCountersTable.$inferSelect;

export const usageRepository = {
  async find(accountId: string, periodStart: string): Promise<UsageCounterRow | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(usageCountersTable)
      .where(and(eq(usageCountersTable.accountId, accountId), eq(usageCountersTable.periodStart, periodStart)))
      .limit(1);
    return row ?? null;
  },

  /**
   * The single atomic conditional UPDATE from PROJECT_SPEC.md §10.5: never
   * read-then-write. The row is upserted first so a fresh period always has
   * something to update — the insert and the update each remain individually
   * atomic, so two concurrent first-charges of a period cannot lose a row,
   * and two concurrent charges at the credit boundary cannot both succeed.
   * Returns the new `credits_used` on success, `null` when the charge would
   * exceed `limit` (the caller's signal that the limit is exhausted).
   */
  async chargeCredits(
    accountId: string,
    periodStart: string,
    cost: number,
    limit: number,
  ): Promise<number | null> {
    const db = getDb();

    await db
      .insert(usageCountersTable)
      .values({ accountId, periodStart })
      .onConflictDoNothing({ target: [usageCountersTable.accountId, usageCountersTable.periodStart] });

    const result = await db.execute<{ credits_used: number }>(sql`
      UPDATE usage_counters
         SET credits_used = credits_used + ${cost}
       WHERE account_id = ${accountId} AND period_start = ${periodStart}
         AND credits_used + ${cost} <= ${limit}
      RETURNING credits_used
    `);

    return result.rows[0]?.credits_used ?? null;
  },

  /** Undoes a charge for a turn that ended up costing the customer nothing — a failed answer must never be billed. */
  async refundCredits(accountId: string, periodStart: string, cost: number): Promise<void> {
    const db = getDb();
    await db.execute(sql`
      UPDATE usage_counters
         SET credits_used = GREATEST(credits_used - ${cost}, 0)
       WHERE account_id = ${accountId} AND period_start = ${periodStart}
    `);
  },

  /**
   * Free accounts have no Stripe subscription to source a billing period
   * from, so the rolling period anchors to signup date instead — this is the
   * one field that read needs. A direct lookup here avoids reaching into
   * account.repository.ts, which is outside this task's territory (same
   * precedent as `getAccountPlan` in server/services/widget/limits.ts).
   */
  async accountCreatedAt(accountId: string): Promise<string | null> {
    const db = getDb();
    const [row] = await db
      .select({ createdAt: accountsTable.createdAt })
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .limit(1);
    return row?.createdAt ?? null;
  },
};
