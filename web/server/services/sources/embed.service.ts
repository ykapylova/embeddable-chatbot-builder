import { env } from "server/env";
import { getOpenAIClient } from "server/services/openai-chat.service";
import { withProviderRetry } from "server/services/provider-retry";

const EMBEDDING_BATCH_SIZE = 96;

/**
 * Embeds texts in batches of 96. A failure on any batch throws and lets the
 * caller discard everything computed so far — partial embeddings never reach
 * the database (see ingest.service.ts).
 *
 * Each batch is retried on its own for a classified-transient failure. Without
 * that, a rate limit on batch 4 of 9 discarded the three good batches with it
 * and the source ended `failed`, telling the owner to reindex a file that was
 * never the problem. Retrying a batch is safe: embedding is a pure function of
 * its input, so a repeat costs money and nothing else.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getOpenAIClient();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await withProviderRetry(
      () => client.embeddings.create({ model: env.openaiEmbeddingModel, input: batch }),
      "sources/embed",
    );
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    embeddings.push(...ordered.map((item) => item.embedding));
  }

  return embeddings;
}
