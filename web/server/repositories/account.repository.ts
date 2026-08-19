import { eq } from "drizzle-orm";

import { getDb } from "server/db/client";
import { accountsTable } from "server/db/schema";

export type AccountRow = typeof accountsTable.$inferSelect;

export const accountRepository = {
  async findByClerkUserId(clerkUserId: string): Promise<AccountRow | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.clerkUserId, clerkUserId))
      .limit(1);
    return row ?? null;
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
