import { and, cosineDistance, count, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "server/db/client";
import { chunksTable, sourcesTable } from "server/db/schema";

export type ChunkRow = typeof chunksTable.$inferSelect;
export type ChunkInsert = typeof chunksTable.$inferInsert;

export type RelevantChunkRow = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string | null;
  content: string;
  score: number;
};

/** Minimal query surface shared by `getDb()` and a transaction handle, so
 * these operations can run standalone or be composed inside another
 * repository's transaction. */
export type QueryExecutor = Pick<ReturnType<typeof getDb>, "insert" | "update" | "delete" | "select">;

export const chunkRepository = {
  /**
   * Cosine search over one bot's chunks, joined with `sources` for the
   * title. pgvector's `<=>` operator returns *distance*, so similarity is
   * `1 - distance` — computed once here and reused for the cutoff and the
   * ordering, never as two separate expressions that could drift apart.
   */
  async findRelevant(
    botId: string,
    embedding: number[],
    opts: { limit: number; minScore: number },
  ): Promise<RelevantChunkRow[]> {
    const db = getDb();
    const similarity = sql<number>`1 - (${cosineDistance(chunksTable.embedding, embedding)})`;

    return db
      .select({
        id: chunksTable.id,
        sourceId: chunksTable.sourceId,
        sourceTitle: sourcesTable.title,
        sourceUrl: sourcesTable.sourceUrl,
        content: chunksTable.content,
        score: similarity,
      })
      .from(chunksTable)
      .innerJoin(sourcesTable, eq(chunksTable.sourceId, sourcesTable.id))
      .where(and(eq(chunksTable.botId, botId), gte(similarity, opts.minScore)))
      .orderBy(desc(similarity))
      .limit(opts.limit);
  },

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
