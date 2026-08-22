import { and, asc, count, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";

import { getDb } from "server/db/client";
import { conversationsTable, messagesTable } from "server/db/schema";

export type ConversationRow = typeof conversationsTable.$inferSelect;
export type ConversationInsert = typeof conversationsTable.$inferInsert;
export type MessageRow = typeof messagesTable.$inferSelect;
export type MessageInsert = typeof messagesTable.$inferInsert;

export type ConversationCursor = { lastMessageAt: string; id: string };

export type ConversationPageFilter = {
  channel?: "app" | "widget";
  ratedDown?: boolean;
  unresolved?: boolean;
};

export type ConversationMessageStats = { messageCount: number; upvotes: number; downvotes: number };

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

/**
 * Drizzle wraps the driver's error, so the `code` that identifies a unique
 * violation sits on the cause rather than on what is thrown — checking only the
 * top level turned a lost race into a 500.
 */
function isUniqueViolation(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 5; depth++) {
    if (typeof current !== "object") return false;
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    const next = (current as { cause?: unknown }).cause;
    if (next === current) return false;
    current = next;
  }
  return false;
}

export const conversationRepository = {
  /**
   * The only way to load a conversation: always scoped to the bot it belongs
   * to, so a conversation from another bot can never be read by id alone.
   */
  async findOwned(conversationId: string, botId: string): Promise<ConversationRow | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(conversationsTable)
      .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.botId, botId)))
      .limit(1);
    return row ?? null;
  },

  async create(values: ConversationInsert): Promise<ConversationRow> {
    const db = getDb();
    const [row] = await db.insert(conversationsTable).values(values).returning();
    return row;
  },

  /** Oldest first, ready to feed straight into an `AnswerRequest`'s history. */
  async recentMessages(conversationId: string, limit: number): Promise<MessageRow[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit);
    return rows.reverse();
  },

  async listMessages(conversationId: string): Promise<MessageRow[]> {
    const db = getDb();
    return db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(asc(messagesTable.createdAt));
  },

  /**
   * Keyset pagination on `(lastMessageAt, id)` descending, not offset — a
   * busy bot's conversation count must never make page 50 slower than page
   * 1. `cutoff` is the plan's retention boundary; rows older than it are
   * excluded here rather than filtered client-side, so a truncated plan
   * never even transfers the hidden rows.
   */
  async listPage(
    botId: string,
    opts: { limit: number; cursor: ConversationCursor | null; cutoff: string; filter: ConversationPageFilter },
  ): Promise<{ rows: ConversationRow[]; hasMore: boolean }> {
    const db = getDb();
    const { limit, cursor, cutoff, filter } = opts;

    const conditions = [eq(conversationsTable.botId, botId), gte(conversationsTable.lastMessageAt, cutoff)];
    if (filter.channel) conditions.push(eq(conversationsTable.channel, filter.channel));
    if (filter.unresolved) conditions.push(eq(conversationsTable.unresolved, true));
    if (filter.ratedDown) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${messagesTable} WHERE ${messagesTable.conversationId} = ${conversationsTable.id} AND ${messagesTable.rating} = -1)`,
      );
    }
    if (cursor) {
      conditions.push(
        or(
          lt(conversationsTable.lastMessageAt, cursor.lastMessageAt),
          and(eq(conversationsTable.lastMessageAt, cursor.lastMessageAt), lt(conversationsTable.id, cursor.id)),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(conversationsTable)
      .where(and(...conditions))
      .orderBy(desc(conversationsTable.lastMessageAt), desc(conversationsTable.id))
      .limit(limit + 1);

    return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
  },

  /** Per-conversation aggregates for the rows already on the page — never
   * computed for the whole bot, so a large history never turns the list into
   * a full table scan. */
  async messageStats(conversationIds: string[]): Promise<Map<string, ConversationMessageStats>> {
    if (conversationIds.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select({
        conversationId: messagesTable.conversationId,
        messageCount: count(),
        upvotes: sql<number>`count(*) filter (where ${messagesTable.rating} = 1)`,
        downvotes: sql<number>`count(*) filter (where ${messagesTable.rating} = -1)`,
      })
      .from(messagesTable)
      .where(inArray(messagesTable.conversationId, conversationIds))
      .groupBy(messagesTable.conversationId);

    return new Map(
      rows.map((row) => [
        row.conversationId,
        { messageCount: Number(row.messageCount), upvotes: Number(row.upvotes), downvotes: Number(row.downvotes) },
      ]),
    );
  },

  /** The visitor's opening line for each conversation, for the list preview
   * — never the full transcript, which is what makes the list cheap at scale. */
  async firstQuestions(conversationIds: string[]): Promise<Map<string, string>> {
    if (conversationIds.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .selectDistinctOn([messagesTable.conversationId], {
        conversationId: messagesTable.conversationId,
        content: messagesTable.content,
      })
      .from(messagesTable)
      .where(and(inArray(messagesTable.conversationId, conversationIds), eq(messagesTable.role, "user")))
      .orderBy(messagesTable.conversationId, asc(messagesTable.createdAt));

    return new Map(rows.map((row) => [row.conversationId, row.content]));
  },

  async countBeforeCutoff(botId: string, cutoff: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ value: count() })
      .from(conversationsTable)
      .where(and(eq(conversationsTable.botId, botId), lt(conversationsTable.lastMessageAt, cutoff)));
    return Number(row?.value ?? 0);
  },

  /** Credits spent by this bot's messages since `since` — the usage summary
   * reads spend straight from `messages` rather than a separate counter,
   * same reasoning as PROJECT_SPEC.md §7's "no `credit_events` table". */
  async creditsUsedSince(botId: string, since: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ value: sql<number>`coalesce(sum(${messagesTable.credits}), 0)` })
      .from(messagesTable)
      .innerJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
      .where(and(eq(conversationsTable.botId, botId), gte(messagesTable.createdAt, since)));
    return Number(row?.value ?? 0);
  },

  /**
   * The assistant turn already recorded for this idempotency key, if any.
   * A Retry of a turn whose stream died after the model had run finds it here
   * and replays it instead of generating — and charging — a second time.
   */
  async findTurnByRequestId(conversationId: string, requestId: string): Promise<MessageRow | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, conversationId),
          eq(messagesTable.requestId, requestId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /**
   * Writes the question and its answer as one unit and bumps `lastMessageAt`,
   * all in the same transaction — the conversation list ordering can never see
   * one without the other, and a rejected answer never leaves an orphan
   * question behind.
   *
   * Returns null when the assistant row loses the unique index on
   * `(conversation_id, request_id)`: a concurrent request carrying the same
   * idempotency key already stored this turn, so this one must not duplicate
   * it. The index is doing the work a lock would otherwise have to.
   */
  async appendTurn(values: {
    conversationId: string;
    question: string;
    assistant: Omit<MessageInsert, "conversationId" | "role" | "content"> & { content: string };
  }): Promise<MessageRow | null> {
    const db = getDb();
    try {
      return await db.transaction(async (tx) => {
        await tx.insert(messagesTable).values({
          conversationId: values.conversationId,
          role: "user",
          content: values.question,
        });

        const [row] = await tx
          .insert(messagesTable)
          .values({ ...values.assistant, conversationId: values.conversationId, role: "assistant" })
          .returning();

        await tx
          .update(conversationsTable)
          .set({ lastMessageAt: new Date().toISOString() })
          .where(eq(conversationsTable.id, values.conversationId));
        return row;
      });
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  },
};
