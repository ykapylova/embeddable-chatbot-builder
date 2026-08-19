import { count, eq } from "drizzle-orm";

import { getDb } from "server/db/client";
import { chunksTable } from "server/db/schema";

export type ChunkRow = typeof chunksTable.$inferSelect;
export type ChunkInsert = typeof chunksTable.$inferInsert;

/** Minimal query surface shared by `getDb()` and a transaction handle, so
 * these operations can run standalone or be composed inside another
 * repository's transaction. */
export type QueryExecutor = Pick<ReturnType<typeof getDb>, "insert" | "update" | "delete" | "select">;

export const chunkRepository = {
  async insertMany(rows: ChunkInsert[], executor: QueryExecutor = getDb()): Promise<void> {
    if (rows.length === 0) return;
    await executor.insert(chunksTable).values(rows);
  },

  async deleteBySource(sourceId: string, executor: QueryExecutor = getDb()): Promise<void> {
    await executor.delete(chunksTable).where(eq(chunksTable.sourceId, sourceId));
  },

  async countBySource(sourceId: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ value: count() })
      .from(chunksTable)
      .where(eq(chunksTable.sourceId, sourceId));
    return Number(row?.value ?? 0);
  },
};
