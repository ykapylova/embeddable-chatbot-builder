import type { RetrievedChunk } from "lib/api-types/retrieval";
import { chunkRepository } from "server/repositories/chunk.repository";
import { embedTexts } from "server/services/sources/embed.service";

const DEFAULT_LIMIT = 5;

// Below this cosine similarity a chunk is noise, not context. An empty
// result here is what lets the bot say "I don't know" instead of answering
// from an unrelated fragment — never lower this to fill the panel.
const SCORE_CUTOFF = 0.35;

/**
 * Embeds the question and returns the closest chunks for one bot, ordered
 * by score descending. Always scoped by `bot_id` — this is the query a
 * chat answer and the debug panel both go through, and neither may see
 * another bot's knowledge.
 */
export async function findRelevantChunks(
  botId: string,
  question: string,
  limit: number = DEFAULT_LIMIT,
): Promise<RetrievedChunk[]> {
  const trimmed = question.trim();
  if (!trimmed) return [];

  const [embedding] = await embedTexts([trimmed]);
  const rows = await chunkRepository.findRelevant(botId, embedding, {
    limit,
    minScore: SCORE_CUTOFF,
  });

  return rows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    sourceTitle: row.sourceTitle,
    content: row.content,
    score: row.score,
  }));
}
