import { and, count, desc, eq } from "drizzle-orm";

import { getDb } from "server/db/client";
import { botsTable, sourcesTable } from "server/db/schema";

export type BotRow = typeof botsTable.$inferSelect;
export type BotInsert = typeof botsTable.$inferInsert;

export const botRepository = {
  async listByAccount(accountId: string): Promise<(BotRow & { sourceCount: number })[]> {
    const db = getDb();
    const rows = await db
      .select({ bot: botsTable, sourceCount: count(sourcesTable.id) })
      .from(botsTable)
      .leftJoin(sourcesTable, eq(sourcesTable.botId, botsTable.id))
      .where(eq(botsTable.accountId, accountId))
      .groupBy(botsTable.id)
      .orderBy(desc(botsTable.createdAt));

    return rows.map((row) => ({ ...row.bot, sourceCount: Number(row.sourceCount) }));
  },

  async countByAccount(accountId: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ value: count() })
      .from(botsTable)
      .where(eq(botsTable.accountId, accountId));
    return Number(row?.value ?? 0);
  },

  /**
   * The only way to load a bot: always together with its accountId. Ownership is
   * part of the query, so "forgot to check the owner" cannot happen.
   */
  async findOwned(botId: string, accountId: string): Promise<BotRow | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(botsTable)
      .where(and(eq(botsTable.id, botId), eq(botsTable.accountId, accountId)))
      .limit(1);
    return row ?? null;
  },

  async findByPublicKey(publicKey: string): Promise<BotRow | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(botsTable)
      .where(eq(botsTable.publicKey, publicKey))
      .limit(1);
    return row ?? null;
  },

  async create(values: BotInsert): Promise<BotRow> {
    const db = getDb();
    const [row] = await db.insert(botsTable).values(values).returning();
    return row;
  },

  async update(
    botId: string,
    accountId: string,
    patch: Partial<BotInsert>,
  ): Promise<BotRow | null> {
    const db = getDb();
    const [row] = await db
      .update(botsTable)
      .set(patch)
      .where(and(eq(botsTable.id, botId), eq(botsTable.accountId, accountId)))
      .returning();
    return row ?? null;
  },

  async remove(botId: string, accountId: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .delete(botsTable)
      .where(and(eq(botsTable.id, botId), eq(botsTable.accountId, accountId)))
      .returning({ id: botsTable.id });
    return rows.length > 0;
  },
};
