import { getDb } from "server/db/client";
import { leadsTable } from "server/db/schema";

export type LeadRow = typeof leadsTable.$inferSelect;
export type LeadInsert = typeof leadsTable.$inferInsert;

export const leadRepository = {
  async create(values: LeadInsert): Promise<LeadRow> {
    const db = getDb();
    const [row] = await db.insert(leadsTable).values(values).returning();
    return row;
  },
};
