import { and, eq, lte } from "drizzle-orm";

import { getDb } from "server/db/client";
import { subscriptionsTable } from "server/db/schema";

export type SubscriptionRow = typeof subscriptionsTable.$inferSelect;
export type SubscriptionPatch = Partial<Omit<typeof subscriptionsTable.$inferInsert, "accountId">>;

/** Accepts either the pooled client or a transaction, so webhook handlers can stay atomic. */
export type QueryExecutor = Pick<ReturnType<typeof getDb>, "insert" | "select">;

export const subscriptionRepository = {
  /** No row means the account has never gone through Stripe checkout (T11) — still on Free. */
  async findByAccount(accountId: string, executor: QueryExecutor = getDb()): Promise<SubscriptionRow | null> {
    const [row] = await executor
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.accountId, accountId))
      .limit(1);
    return row ?? null;
  },

  async findByStripeCustomerId(
    stripeCustomerId: string,
    executor: QueryExecutor = getDb(),
  ): Promise<SubscriptionRow | null> {
    const [row] = await executor
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return row ?? null;
  },

  /**
   * Insert-or-merge keyed by `accountId`. Webhook handlers pass only the
   * fields the event actually carries, so an earlier event's data is never
   * clobbered by a later one that doesn't know about it.
   */
  async upsert(
    accountId: string,
    patch: SubscriptionPatch,
    executor: QueryExecutor = getDb(),
  ): Promise<SubscriptionRow> {
    const [row] = await executor
      .insert(subscriptionsTable)
      .values({ accountId, ...patch })
      .onConflictDoUpdate({ target: subscriptionsTable.accountId, set: patch })
      .returning();
    return row;
  },

  /** Accounts whose 7-day grace window (PROJECT_SPEC.md §10.8 #10) has elapsed without a successful retry. */
  async findExpiredGrace(now: Date = new Date(), executor: QueryExecutor = getDb()): Promise<SubscriptionRow[]> {
    return executor
      .select()
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.paymentFailed, true), lte(subscriptionsTable.graceUntil, now.toISOString())));
  },
};
