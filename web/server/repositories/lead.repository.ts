import { and, desc, eq, lt, or } from "drizzle-orm";

import { getDb } from "server/db/client";
import { leadsTable } from "server/db/schema";

export type LeadRow = typeof leadsTable.$inferSelect;
export type LeadInsert = typeof leadsTable.$inferInsert;

export type LeadCursor = { createdAt: string; id: string };

export const leadRepository = {
  async create(values: LeadInsert): Promise<LeadRow> {
    const db = getDb();
    const [row] = await db.insert(leadsTable).values(values).returning();
    return row;
  },

  /** Keyset pagination on `(createdAt, id)` descending, matching `leads_bot_id_created_at_idx`. */
  async listPage(
    botId: string,
    opts: { limit: number; cursor: LeadCursor | null },
  ): Promise<{ rows: LeadRow[]; hasMore: boolean }> {
    const db = getDb();
    const conditions = [eq(leadsTable.botId, botId)];
    if (opts.cursor) {
      conditions.push(
        or(
          lt(leadsTable.createdAt, opts.cursor.createdAt),
          and(eq(leadsTable.createdAt, opts.cursor.createdAt), lt(leadsTable.id, opts.cursor.id)),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(leadsTable)
      .where(and(...conditions))
      .orderBy(desc(leadsTable.createdAt), desc(leadsTable.id))
      .limit(opts.limit + 1);

    return { rows: rows.slice(0, opts.limit), hasMore: rows.length > opts.limit };
  },

  /** Unpaginated, for CSV export — a bot's leads are never large enough to need streaming. */
  async listAllForExport(botId: string): Promise<LeadRow[]> {
    const db = getDb();
    return db
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.botId, botId))
      .orderBy(desc(leadsTable.createdAt));
  },
};
