import { eq } from "drizzle-orm";

import type { PlanId } from "lib/plans";
import { getDb } from "server/db/client";
import { accountsTable } from "server/db/schema";

export type AccountRow = typeof accountsTable.$inferSelect;

/** Accepts either the pooled client or a transaction, so webhook handlers can stay atomic. */
type QueryExecutor = Pick<ReturnType<typeof getDb>, "select" | "update">;

export const accountRepository = {
  async findByClerkUserId(clerkUserId: string, executor: QueryExecutor = getDb()): Promise<AccountRow | null> {
    const [row] = await executor
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.clerkUserId, clerkUserId))
      .limit(1);
    return row ?? null;
  },

  /** The denormalised plan every gating check reads — kept in sync by Stripe webhooks (T11). */
  async updatePlan(accountId: string, plan: PlanId, executor: QueryExecutor = getDb()): Promise<void> {
    await executor.update(accountsTable).set({ plan }).where(eq(accountsTable.id, accountId));
  },

  /**
   * Accounts are created lazily on a signed-in user's first request. There is
   * deliberately no Clerk `user.created` webhook: it adds a failure mode (a missed
   * webhook leaves a user with no account) and buys nothing here.
   */
  async create(clerkUserId: string, email: string): Promise<AccountRow> {
    const db = getDb();
    const [row] = await db
      .insert(accountsTable)
      .values({ clerkUserId, email })
      .onConflictDoNothing({ target: accountsTable.clerkUserId })
      .returning();

    if (row) return row;

    // Two concurrent first requests raced; the other one inserted the row.
    const existing = await this.findByClerkUserId(clerkUserId);
    if (!existing) {
      throw new Error("Account insert conflicted but row is missing");
    }
    return existing;
  },
};
