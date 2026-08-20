import { sql } from "drizzle-orm";

import { getDb } from "server/db/client";
import { conversationsTable, messagesTable } from "server/db/schema";

export type GapMessageRow = {
  id: string;
  conversationId: string;
  createdAt: string;
  /** The visitor question that triggered this failure, or null if none preceded it. */
  question: string | null;
};

type GapMessageQueryRow = {
  id: string;
  conversation_id: string;
  created_at: string;
  question: string | null;
};

const GAP_ROW_LIMIT = 1000;

export const gapRepository = {
  /**
   * Assistant turns that failed (no citations, or a 👎), each paired with the
   * nearest preceding visitor question via a LATERAL lookup. The WHERE clause
   * mirrors `messages_gaps_idx` exactly so Postgres can use it for the
   * assistant-side scan instead of a full table scan.
   */
  async listFailures(botId: string): Promise<GapMessageRow[]> {
    const db = getDb();
    const result = await db.execute<GapMessageQueryRow>(sql`
      SELECT m.id, m.conversation_id, m.created_at, uq.content AS question
      FROM ${messagesTable} m
      INNER JOIN ${conversationsTable} c ON c.id = m.conversation_id
      LEFT JOIN LATERAL (
        SELECT um.content
        FROM ${messagesTable} um
        WHERE um.conversation_id = m.conversation_id
          AND um.role = 'user'
          AND um.created_at <= m.created_at
        ORDER BY um.created_at DESC
        LIMIT 1
      ) uq ON true
      WHERE c.bot_id = ${botId}
        AND m.role = 'assistant'
        AND (m.rating = -1 OR m.citations = '[]'::jsonb)
      ORDER BY m.created_at DESC
      LIMIT ${GAP_ROW_LIMIT}
    `);

    return result.rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      createdAt: row.created_at,
      question: row.question,
    }));
  },
};
