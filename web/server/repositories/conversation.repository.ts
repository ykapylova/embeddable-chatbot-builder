import { and, asc, desc, eq } from "drizzle-orm";

import { getDb } from "server/db/client";
import { conversationsTable, messagesTable } from "server/db/schema";

export type ConversationRow = typeof conversationsTable.$inferSelect;
export type ConversationInsert = typeof conversationsTable.$inferInsert;
export type MessageRow = typeof messagesTable.$inferSelect;
export type MessageInsert = typeof messagesTable.$inferInsert;

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
   * Appends a message and bumps `lastMessageAt` in the same transaction, so
   * the conversation list ordering can never see one without the other.
   */
  async appendMessage(values: MessageInsert): Promise<MessageRow> {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [row] = await tx.insert(messagesTable).values(values).returning();
      await tx
        .update(conversationsTable)
        .set({ lastMessageAt: new Date().toISOString() })
        .where(eq(conversationsTable.id, values.conversationId));
      return row;
    });
  },
};
