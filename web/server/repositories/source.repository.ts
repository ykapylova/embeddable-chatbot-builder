import { and, desc, eq, ne, sql } from "drizzle-orm";

import { getDb } from "server/db/client";
import { sourcesTable } from "server/db/schema";

import { chunkRepository } from "./chunk.repository";

export type SourceRow = typeof sourcesTable.$inferSelect;
export type SourceInsert = typeof sourcesTable.$inferInsert;

export type NewChunkContent = {
  content: string;
  tokenCount: number;
  embedding: number[];
  metadata: Record<string, unknown>;
};

export const sourceRepository = {
  async listByBot(botId: string): Promise<SourceRow[]> {
    const db = getDb();
    return db
      .select()
      .from(sourcesTable)
      .where(eq(sourcesTable.botId, botId))
      .orderBy(desc(sourcesTable.createdAt));
  },

  /**
   * The only way to load a source: always scoped to the bot it belongs to, so
   * a source from another bot can never be read or mutated by id alone.
   */
  async findOwned(sourceId: string, botId: string): Promise<SourceRow | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(sourcesTable)
      .where(and(eq(sourcesTable.id, sourceId), eq(sourcesTable.botId, botId)))
      .limit(1);
    return row ?? null;
  },

  async create(values: SourceInsert): Promise<SourceRow> {
    const db = getDb();
    const [row] = await db.insert(sourcesTable).values(values).returning();
    return row;
  },

  async update(
    sourceId: string,
    botId: string,
    patch: Partial<SourceInsert>,
  ): Promise<SourceRow | null> {
    const db = getDb();
    const [row] = await db
      .update(sourcesTable)
      .set(patch)
      .where(and(eq(sourcesTable.id, sourceId), eq(sourcesTable.botId, botId)))
      .returning();
    return row ?? null;
  },

  /**
   * Claims a source for an indexing run: marks it `processing`, clears the last
   * failure and bumps `index_version`.
   *
   * Returns null when the row is already `processing`, which is what makes two
   * clicks on Retry one run instead of two full fetches and two embedding
   * bills. The bumped version is the run's ticket: it must be handed back to
   * `replaceChunksAndMarkReady`, so a run that has since been superseded
   * cannot overwrite the fresher one that superseded it.
   */
  async beginIndexing(sourceId: string, botId: string): Promise<SourceRow | null> {
    const db = getDb();
    const [row] = await db
      .update(sourcesTable)
      .set({
        status: "processing",
        error: null,
        errorCode: null,
        indexVersion: sql`${sourcesTable.indexVersion} + 1`,
      })
      .where(
        and(
          eq(sourcesTable.id, sourceId),
          eq(sourcesTable.botId, botId),
          ne(sourcesTable.status, "processing"),
        ),
      )
      .returning();
    return row ?? null;
  },

  /** Returns the deleted row's `storageKey` so the caller can drop its blob too; null when nothing matched. */
  async remove(sourceId: string, botId: string): Promise<{ storageKey: string | null } | null> {
    const db = getDb();
    const [row] = await db
      .delete(sourcesTable)
      .where(and(eq(sourcesTable.id, sourceId), eq(sourcesTable.botId, botId)))
      .returning({ storageKey: sourcesTable.storageKey });
    return row ?? null;
  },

  /**
   * Replaces a source's chunks and marks it ready in one transaction. A
   * reindex must never leave the bot answering from a half-old, half-new
   * knowledge base, so the old chunks are only dropped once the new ones are
   * ready to take their place.
   *
   * The update is conditional on `indexVersion`: a run that started before a
   * newer one finds no row to update, rolls the whole transaction back and
   * leaves the fresher content in place. Returning null is how the caller
   * learns it lost — and it also covers the source having been deleted
   * mid-run.
   */
  async replaceChunksAndMarkReady(
    sourceId: string,
    botId: string,
    chunks: NewChunkContent[],
    counts: { charCount: number; chunkCount: number; indexVersion: number },
  ): Promise<SourceRow | null> {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(sourcesTable)
        .set({
          status: "ready",
          error: null,
          errorCode: null,
          charCount: counts.charCount,
          chunkCount: counts.chunkCount,
          indexedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(sourcesTable.id, sourceId),
            eq(sourcesTable.botId, botId),
            eq(sourcesTable.indexVersion, counts.indexVersion),
          ),
        )
        .returning();

      // Claim the row before writing chunks, so a stale run does no work at all
      // rather than deleting the current chunks and then discovering it lost.
      if (!claimed) return null;

      await chunkRepository.deleteBySource(sourceId, tx);

      await chunkRepository.insertMany(
        chunks.map((chunk, index) => ({
          sourceId,
          botId,
          chunkIndex: index,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embedding: chunk.embedding,
          metadata: chunk.metadata,
        })),
        tx,
      );

      return claimed;
    });
  },
};
