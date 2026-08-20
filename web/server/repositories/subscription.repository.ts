import { eq } from "drizzle-orm";

import { getDb } from "server/db/client";
import { subscriptionsTable } from "server/db/schema";

export type SubscriptionRow = typeof subscriptionsTable.$inferSelect;

export const subscriptionRepository = {
  /** No row means the account has never gone through Stripe checkout (T11) — still on Free. */
  async findByAccount(accountId: string): Promise<SubscriptionRow | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.accountId, accountId))
      .limit(1);
    return row ?? null;
  },
};
