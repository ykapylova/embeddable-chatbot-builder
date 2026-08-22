import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { Source } from "lib/api-types/source";
import type { PlanId } from "lib/plans";
import { botRepository } from "server/repositories/bot.repository";
import { sourceRepository, type SourceRow } from "server/repositories/source.repository";
import {
  extensionFromFilename,
  isAllowedSourceFileExtension,
  SOURCE_FAQ_ANSWER_MAX_CHARS,
  SOURCE_FAQ_QUESTION_MAX_CHARS,
  SOURCE_FILE_MAX_BYTES,
  SOURCE_TEXT_MAX_CHARS,
  SOURCE_TITLE_MAX,
} from "server/limits";
import { invalidateAnswerCache } from "server/services/answer/cache";
import { assertPlan } from "server/services/plan.service";
import { uploadBytesToChatBucket } from "server/services/supabase-storage.service";

import { SourceBusyError, SourceContentError, SourceValidationError } from "./errors";
import { ingestSource } from "./ingest.service";
import { extractTextForFile, extractTextFromHtml } from "./parse.service";
import { discardSourceBlobs } from "./storage-cleanup.service";
import { downloadFromChatBucket } from "./storage-fetch.service";
import { fetchUrlHtml } from "./url-fetch.service";

const createUrlSourceSchema = z.object({
  type: z.literal("url"),
  url: z.string().trim().min(1, "URL is required").max(2048).url("Enter a valid URL"),
});

const createTextSourceSchema = z.object({
  type: z.literal("text"),
  title: z.string().trim().min(1, "Title is required").max(SOURCE_TITLE_MAX),
  content: z.string().trim().min(1, "Content is required").max(SOURCE_TEXT_MAX_CHARS),
});

const createFaqSourceSchema = z.object({
  type: z.literal("faq"),
  question: z.string().trim().min(1, "Question is required").max(SOURCE_FAQ_QUESTION_MAX_CHARS),
  answer: z.string().trim().min(1, "Answer is required").max(SOURCE_FAQ_ANSWER_MAX_CHARS),
});

const createJsonSourceSchema = z.discriminatedUnion("type", [
  createUrlSourceSchema,
  createTextSourceSchema,
  createFaqSourceSchema,
]);

function toSource(row: SourceRow): Source {
  return {
    id: row.id,
    botId: row.botId,
    type: row.type,
    title: row.title,
    sourceUrl: row.sourceUrl,
    status: row.status,
    error: row.error,
    errorCode: row.errorCode,
    charCount: row.charCount,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt,
    indexedAt: row.indexedAt,
  };
}

async function requireOwnedBot(botId: string, accountId: string) {
  return botRepository.findOwned(botId, accountId);
}

async function uploadTextBlob(storageKey: string, text: string): Promise<void> {
  try {
    await uploadBytesToChatBucket(storageKey, Buffer.from(text, "utf-8"), "text/plain; charset=utf-8");
  } catch (error) {
    console.error("[sourceService] storage upload failed", error instanceof Error ? error.message : error);
    throw new SourceValidationError("Could not save this source. Try again.");
  }
}

function urlTitle(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname !== "/" ? parsed.pathname : "";
    return `${parsed.hostname}${path}`.slice(0, SOURCE_TITLE_MAX);
  } catch {
    return url.slice(0, SOURCE_TITLE_MAX);
  }
}

/** Creates the pending row, then runs extraction and indexing before
 * returning. A content-extraction failure (bad PDF, unreachable URL) ends the
 * source as `failed` rather than failing the request — the row always exists
 * so the account owner can see and retry it. */
async function createAndProcess(
  botId: string,
  plan: PlanId,
  values: { type: SourceRow["type"]; title: string; sourceUrl?: string | null; storageKey?: string | null },
  getRawText: () => Promise<string>,
): Promise<Source> {
  let created: SourceRow;
  try {
    created = await sourceRepository.create({
      botId,
      type: values.type,
      title: values.title,
      sourceUrl: values.sourceUrl ?? null,
      storageKey: values.storageKey ?? null,
    });
  } catch (error) {
    // The blob is uploaded before the row exists, so a failed insert is the one
    // moment an object is left with nothing that will ever reference it.
    await discardSourceBlobs([values.storageKey]);
    throw error;
  }

  const claimed = await sourceRepository.beginIndexing(created.id, botId);
  const indexVersion = claimed?.indexVersion ?? created.indexVersion + 1;

  let rawText: string;
  try {
    rawText = await getRawText();
  } catch (error) {
    return toSource(await markExtractionFailed(created, error, "[sourceService] extraction failed"));
  }

  const finalRow = await ingestSource(claimed ?? created, rawText, plan, indexVersion);
  return toSource(finalRow);
}

/**
 * The one place an extraction failure becomes a stored row, so the sentence and
 * the code can never be written by one path and forgotten by another.
 */
async function markExtractionFailed(
  source: SourceRow,
  error: unknown,
  logLabel: string,
): Promise<SourceRow> {
  const expected = error instanceof SourceContentError;
  if (!expected) console.error(logLabel, source.id, error);

  const message = expected ? error.message : "Could not read this source. Try again.";
  const errorCode = expected ? error.code : "UNKNOWN";

  const failed = await sourceRepository.update(source.id, source.botId, {
    status: "failed",
    error: message,
    errorCode,
  });
  return failed ?? { ...source, status: "failed", error: message, errorCode };
}

async function getRawTextForReindex(source: SourceRow): Promise<string> {
  if (source.type === "url") {
    if (!source.sourceUrl) {
      throw new SourceContentError("This source has no URL to re-fetch.", "UNSUPPORTED_CONTENT");
    }
    return extractTextFromHtml(await fetchUrlHtml(source.sourceUrl));
  }

  if (!source.storageKey) {
    throw new SourceContentError("This source has no stored content to reindex.", "STORAGE_FAILED");
  }

  const bytes = await downloadFromChatBucket(source.storageKey);

  if (source.type === "file") {
    const extension = extensionFromFilename(source.storageKey);
    if (!isAllowedSourceFileExtension(extension)) {
      throw new SourceContentError("This file's format is no longer supported.", "UNSUPPORTED_CONTENT");
    }
    return extractTextForFile(bytes, extension);
  }

  // text / faq were stored as plain utf-8 blobs at creation time.
  return bytes.toString("utf-8");
}

export const sourceService = {
  async list(botId: string, accountId: string): Promise<Source[] | null> {
    const bot = await requireOwnedBot(botId, accountId);
    if (!bot) return null;
    const rows = await sourceRepository.listByBot(botId);
    return rows.map(toSource);
  },

  async create(botId: string, accountId: string, plan: PlanId, input: unknown): Promise<Source | null> {
    const bot = await requireOwnedBot(botId, accountId);
    if (!bot) return null;

    const parsed = createJsonSourceSchema.parse(input);
    await assertPlan({ type: "sources", botId, plan });

    if (parsed.type === "url") {
      return createAndProcess(
        botId,
        plan,
        { type: "url", title: urlTitle(parsed.url), sourceUrl: parsed.url },
        async () => extractTextFromHtml(await fetchUrlHtml(parsed.url)),
      );
    }

    if (parsed.type === "text") {
      const storageKey = `sources/${botId}/${randomUUID()}/content.txt`;
      await uploadTextBlob(storageKey, parsed.content);
      return createAndProcess(
        botId,
        plan,
        { type: "text", title: parsed.title.slice(0, SOURCE_TITLE_MAX), storageKey },
        () => Promise.resolve(parsed.content),
      );
    }

    const combined = `Q: ${parsed.question}\nA: ${parsed.answer}`;
    const storageKey = `sources/${botId}/${randomUUID()}/content.txt`;
    await uploadTextBlob(storageKey, combined);
    return createAndProcess(
      botId,
      plan,
      { type: "faq", title: parsed.question.slice(0, SOURCE_TITLE_MAX), storageKey },
      () => Promise.resolve(combined),
    );
  },

  async createFromFile(
    botId: string,
    accountId: string,
    plan: PlanId,
    formData: FormData,
  ): Promise<Source | null> {
    const bot = await requireOwnedBot(botId, accountId);
    if (!bot) return null;

    await assertPlan({ type: "sources", botId, plan });

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new SourceValidationError("A file is required");
    }
    if (file.size === 0) {
      throw new SourceValidationError("The file is empty");
    }
    if (file.size > SOURCE_FILE_MAX_BYTES) {
      throw new SourceValidationError(
        `Files must be under ${Math.floor(SOURCE_FILE_MAX_BYTES / (1024 * 1024))}MB`,
      );
    }

    const extension = extensionFromFilename(file.name);
    if (!isAllowedSourceFileExtension(extension)) {
      throw new SourceValidationError("Only PDF, TXT and MD files are supported");
    }

    const titleField = formData.get("title");
    const title =
      (typeof titleField === "string" && titleField.trim()) || file.name || "Untitled file";

    const bytes = Buffer.from(await file.arrayBuffer());
    const storageKey = `sources/${botId}/${randomUUID()}/original.${extension}`;

    try {
      await uploadBytesToChatBucket(storageKey, bytes, file.type || "application/octet-stream");
    } catch (error) {
      console.error("[sourceService.createFromFile] upload failed", error instanceof Error ? error.message : error);
      throw new SourceValidationError("Could not upload the file. Try again.");
    }

    return createAndProcess(
      botId,
      plan,
      { type: "file", title: title.slice(0, SOURCE_TITLE_MAX), storageKey },
      () => extractTextForFile(bytes, extension),
    );
  },

  async remove(botId: string, accountId: string, sourceId: string): Promise<boolean> {
    const bot = await requireOwnedBot(botId, accountId);
    if (!bot) return false;
    const removed = await sourceRepository.remove(sourceId, botId);
    if (!removed) return false;

    await discardSourceBlobs([removed.storageKey]);
    // Removing a source is a knowledge change too — drop any cached answers
    // that might have leaned on it.
    await invalidateAnswerCache(botId);
    return true;
  },


  async reindex(botId: string, accountId: string, plan: PlanId, sourceId: string): Promise<Source | null> {
    const bot = await requireOwnedBot(botId, accountId);
    if (!bot) return null;

    const source = await sourceRepository.findOwned(sourceId, botId);
    if (!source) return null;

    // Two clicks on Retry used to be two full runs — two fetches, two embedding
    // bills — with the later-*finishing* one winning, which is not necessarily
    // the later-started one. Claiming the row is what makes the second click a
    // no-op instead of a race.
    const claimed = await sourceRepository.beginIndexing(sourceId, botId);
    if (!claimed) {
      throw new SourceBusyError("This source is already being indexed. Wait for it to finish.");
    }

    let rawText: string;
    try {
      rawText = await getRawTextForReindex(claimed);
    } catch (error) {
      return toSource(
        await markExtractionFailed(claimed, error, "[sourceService.reindex] extraction failed"),
      );
    }

    const finalRow = await ingestSource(claimed, rawText, plan, claimed.indexVersion);
    return toSource(finalRow);
  },
};

export { SourceBusyError, SourceValidationError } from "./errors";
