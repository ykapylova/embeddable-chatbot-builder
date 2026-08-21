import { and, desc, eq } from "drizzle-orm";

import { getDb } from "server/db/client";
import { sourcesTable } from "server/db/schema";

import { chunkRepository } from "./chunk.repository";

export type SourceRow = typeof sourcesTable.$inferSelect;
export type SourceInsert = typeof sourcesTable.$inferInsert;

export type NewChunkContent = {
  content: string;
  tokenCount: number;
  embedding: number[];
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
   */
  async replaceChunksAndMarkReady(
    sourceId: string,
    botId: string,
    chunks: NewChunkContent[],
    counts: { charCount: number; chunkCount: number },
  ): Promise<SourceRow | null> {
    const db = getDb();
    return db.transaction(async (tx) => {
      await chunkRepository.deleteBySource(sourceId, tx);

      await chunkRepository.insertMany(
        chunks.map((chunk, index) => ({
          sourceId,
          botId,
          chunkIndex: index,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embedding: chunk.embedding,
        })),
        tx,
      );

      const [row] = await tx
        .update(sourcesTable)
        .set({
          status: "ready",
          error: null,
          charCount: counts.charCount,
          chunkCount: counts.chunkCount,
          indexedAt: new Date().toISOString(),
        })
        .where(and(eq(sourcesTable.id, sourceId), eq(sourcesTable.botId, botId)))
        .returning();
      return row ?? null;
    });
  },
};
