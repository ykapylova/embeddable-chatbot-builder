import type { PlanId } from "lib/plans";
import { sourceRepository, type SourceRow } from "server/repositories/source.repository";
import { assertPlan, PlanLimitError } from "server/services/plan.service";

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

/** Failures the owner caused and can act on, as opposed to something breaking. */
function ownerFacingMessage(error: unknown): string | null {
  if (error instanceof SourceContentError || error instanceof PlanLimitError) return error.message;
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
 */
export async function ingestSource(
  source: SourceRow,
  rawText: string,
  plan: PlanId,
): Promise<SourceRow> {
  const { id: sourceId, botId } = source;

  try {
    const normalized = normalizeExtractedText(rawText);
    if (!normalized) {
      throw new SourceContentError(emptyContentMessage(source.type));
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
    return updated;
  } catch (error) {
    const expected = ownerFacingMessage(error);
    const message = expected ?? "Something went wrong while indexing this source. Try reindexing.";

    if (!expected) {
      // Never log source content — only the id and the failure itself.
      console.error("[ingestSource]", sourceId, error);
    }

    const failed = await sourceRepository.update(sourceId, botId, { status: "failed", error: message });
    return failed ?? { ...source, status: "failed", error: message };
  }
}
