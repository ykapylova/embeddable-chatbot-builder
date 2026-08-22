import type { PlanId } from "lib/plans";
import { sourceRepository, type SourceRow } from "server/repositories/source.repository";
import { invalidateAnswerCache } from "server/services/answer/cache";
import { assertPlan, PlanLimitError } from "server/services/plan.service";

import { chunkText } from "./chunk.service";
import { embedTexts } from "./embed.service";
import { SourceContentError, type SourceErrorCode } from "./errors";
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

type OwnerFacingFailure = { message: string; code: SourceErrorCode };

/** Failures the owner caused and can act on, as opposed to something breaking. */
function ownerFacingFailure(error: unknown): OwnerFacingFailure | null {
  if (error instanceof SourceContentError) return { message: error.message, code: error.code };
  if (error instanceof PlanLimitError) {
    // The only plan limit reachable from inside indexing is the character cap.
    return { message: error.message, code: "LIMIT_CHARS" };
  }
  return null;
}

/**
 * Normalizes, chunks and embeds raw extracted text, then writes the result
 * atomically. Nothing is written to the database until every batch of
 * embeddings has succeeded, so a mid-pipeline failure (a bad chunk, a failed
 * OpenAI call) never leaves the source with partial content — it ends as
 * `failed` with the previous chunks (if any) untouched.
 *
 * The character cap is enforced here rather than at the call sites because this
 * is where the number it counts is produced: `charCount` is the *normalized*
 * length, and for a URL or a file nothing upstream knows it — a 2MB PDF and a
 * 2MB text file do not carry the same amount of text. Placing it before
 * `chunkText` also means an over-limit source is never embedded, which is what
 * the cap is protecting.
 *
 * `indexVersion` is the version this run claimed when it started. It is carried
 * into the commit so a slow run whose source has since been reindexed discards
 * its own results instead of overwriting the fresher ones.
 */
export async function ingestSource(
  source: SourceRow,
  rawText: string,
  plan: PlanId,
  indexVersion: number,
): Promise<SourceRow> {
  const { id: sourceId, botId } = source;

  try {
    const normalized = normalizeExtractedText(rawText);
    if (!normalized) {
      throw new SourceContentError(emptyContentMessage(source.type), "EMPTY_SOURCE");
    }

    await assertPlan({
      type: "sourceChars",
      botId,
      plan,
      incomingChars: normalized.length,
      replacedSourceId: sourceId,
    });

    const chunks = chunkText(normalized);
    if (chunks.length === 0) {
      throw new SourceContentError(emptyContentMessage(source.type), "EMPTY_SOURCE");
    }

    let embeddings: number[][];
    try {
      embeddings = await embedTexts(chunks.map((chunk) => chunk.content));
    } catch (error) {
      console.error("[ingestSource] embedding failed", sourceId, error);
      throw new SourceContentError(
        "Could not build the search index for this source. Try reindexing.",
        "EMBEDDING_FAILED",
      );
    }

    const updated = await sourceRepository.replaceChunksAndMarkReady(
      sourceId,
      botId,
      chunks.map((chunk, index) => ({
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: embeddings[index],
        metadata: { heading: chunk.heading, url: source.sourceUrl },
      })),
      { charCount: normalized.length, chunkCount: chunks.length, indexVersion },
    );

    if (!updated) {
      // Either the source was deleted while it was being indexed, or a newer
      // run has claimed the version — in both cases this run's chunks are the
      // wrong ones and were rolled back with the transaction.
      return (await sourceRepository.findOwned(sourceId, botId)) ?? source;
    }

    // The bot's knowledge just changed, so any answer cached against the old
    // content is now potentially stale. Correctness over hit rate: drop it.
    await invalidateAnswerCache(botId);
    return updated;
  } catch (error) {
    const expected = ownerFacingFailure(error);
    const failure: OwnerFacingFailure = expected ?? {
      message: "Something went wrong while indexing this source. Try reindexing.",
      code: "UNKNOWN",
    };

    if (!expected) {
      // Never log source content — only the id and the failure itself.
      console.error("[ingestSource]", sourceId, error);
    }

    const failed = await sourceRepository.update(sourceId, botId, {
      status: "failed",
      error: failure.message,
      errorCode: failure.code,
    });
    return failed ?? { ...source, status: "failed", error: failure.message, errorCode: failure.code };
  }
}
