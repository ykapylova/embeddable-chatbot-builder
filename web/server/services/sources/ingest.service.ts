import { sourceRepository, type SourceRow } from "server/repositories/source.repository";
import { invalidateAnswerCache } from "server/services/answer/cache";

import { chunkText } from "./chunk.service";
import { embedTexts } from "./embed.service";
import { SourceContentError } from "./errors";
import { normalizeExtractedText } from "./normalize.service";

function emptyContentMessage(type: SourceRow["type"]): string {
  switch (type) {
    case "file":
      return "This file has no extractable text — it may be a scan.";
    case "url":
      return "This page has no readable text content.";
    default:
      return "There is no content to index.";
  }
}

/**
 * Normalizes, chunks and embeds raw extracted text, then writes the result
 * atomically. Nothing is written to the database until every batch of
 * embeddings has succeeded, so a mid-pipeline failure (a bad chunk, a failed
 * OpenAI call) never leaves the source with partial content — it ends as
 * `failed` with the previous chunks (if any) untouched.
 */
export async function ingestSource(source: SourceRow, rawText: string): Promise<SourceRow> {
  const { id: sourceId, botId } = source;

  try {
    const normalized = normalizeExtractedText(rawText);
    if (!normalized) {
      throw new SourceContentError(emptyContentMessage(source.type));
    }

    const chunks = chunkText(normalized);
    if (chunks.length === 0) {
      throw new SourceContentError(emptyContentMessage(source.type));
    }

    const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

    const updated = await sourceRepository.replaceChunksAndMarkReady(
      sourceId,
      botId,
      chunks.map((chunk, index) => ({
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: embeddings[index],
      })),
      { charCount: normalized.length, chunkCount: chunks.length },
    );

    if (!updated) {
      throw new Error("Source was removed while it was being indexed");
    }

    // The bot's knowledge just changed, so any answer cached against the old
    // content is now potentially stale. Correctness over hit rate: drop it.
    await invalidateAnswerCache(botId);
    return updated;
  } catch (error) {
    const message =
      error instanceof SourceContentError
        ? error.message
        : "Something went wrong while indexing this source. Try reindexing.";

    if (!(error instanceof SourceContentError)) {
      // Never log source content — only the id and the failure itself.
      console.error("[ingestSource]", sourceId, error);
    }

    const failed = await sourceRepository.update(sourceId, botId, { status: "failed", error: message });
    return failed ?? { ...source, status: "failed", error: message };
  }
}
