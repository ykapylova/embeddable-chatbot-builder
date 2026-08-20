import { and, eq } from "drizzle-orm";

import { getDb } from "server/db/client";
import { messagesTable } from "server/db/schema";

const RATING_VALUE: Record<"up" | "down", number> = { up: 1, down: -1 };

/**
 * Scoped to the conversation, not just the message id, so a rating can only
 * ever land on a message the caller already proved it owns (the route checks
 * `conversation.botId` first). No `conversation.repository.ts` method exists
 * for this yet — rating is new in this task, so it stays local rather than
 * reaching into a file outside this task's territory.
 */
export async function rateMessage(
  conversationId: string,
  messageId: string,
  rating: "up" | "down",
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(messagesTable)
    .set({ rating: RATING_VALUE[rating] })
    .where(and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, conversationId)))
    .returning({ id: messagesTable.id });
  return rows.length > 0;
}
