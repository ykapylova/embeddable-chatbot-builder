import { env } from "server/env";
import { getOpenAIClient } from "server/services/openai-chat.service";

const EMBEDDING_BATCH_SIZE = 96;

/**
 * Embeds texts in batches of 96. A failure on any batch throws and lets the
 * caller discard everything computed so far — partial embeddings never reach
 * the database (see ingest.service.ts).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getOpenAIClient();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await client.embeddings.create({
      model: env.openaiEmbeddingModel,
      input: batch,
    });
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    embeddings.push(...ordered.map((item) => item.embedding));
  }

  return embeddings;
}
