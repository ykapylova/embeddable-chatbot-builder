import { and, eq, sql } from "drizzle-orm";

import type { ChatCitation } from "lib/api-types/chat";
import { getDb } from "server/db/client";
import { answerCacheTable } from "server/db/schema";

export type AnswerCacheRow = typeof answerCacheTable.$inferSelect;

export type CachedAnswer = {
  answer: string;
  citations: ChatCitation[];
};

export const answerCacheRepository = {
  /**
   * Reads a cached answer and counts the hit in one round trip. `hits` is only
   * for observability — whether the cache is earning its keep — so the update
   * runs unconditionally and the caller decides what to do with a null.
   */
  async get(botId: string, questionHash: string): Promise<CachedAnswer | null> {
    const db = getDb();
    const rows = await db
      .update(answerCacheTable)
      .set({ hits: sql`${answerCacheTable.hits} + 1` })
      .where(and(eq(answerCacheTable.botId, botId), eq(answerCacheTable.questionHash, questionHash)))
      .returning({ answer: answerCacheTable.answer, citations: answerCacheTable.citations });

    const row = rows[0];
    if (!row) return null;
    return { answer: row.answer, citations: row.citations as ChatCitation[] };
  },

  /**
   * Writes an answer for later reuse. Keyed by `(bot_id, question_hash)`, so a
   * repeat of the same normalised question overwrites rather than duplicates —
   * the last good answer wins and the hit counter resets with it.
   */
  async put(
    botId: string,
    questionHash: string,
    question: string,
    answer: string,
    citations: ChatCitation[],
  ): Promise<void> {
    const db = getDb();
    await db
      .insert(answerCacheTable)
      .values({ botId, questionHash, question, answer, citations })
      .onConflictDoUpdate({
        target: [answerCacheTable.botId, answerCacheTable.questionHash],
        set: { answer, citations, question, hits: 0, createdAt: sql`now()` },
      });
  },

  /** Drops every cached answer for one bot. Called when its sources change. */
  async deleteByBot(botId: string): Promise<void> {
    const db = getDb();
    await db.delete(answerCacheTable).where(eq(answerCacheTable.botId, botId));
  },
};
