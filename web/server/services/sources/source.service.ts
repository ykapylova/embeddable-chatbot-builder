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

import { SourceContentError, SourceValidationError } from "./errors";
import { ingestSource } from "./ingest.service";
import { extractTextForFile, extractTextFromHtml } from "./parse.service";
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
  values: { type: SourceRow["type"]; title: string; sourceUrl?: string | null; storageKey?: string | null },
  getRawText: () => Promise<string>,
): Promise<Source> {
  const created = await sourceRepository.create({
    botId,
    type: values.type,
    title: values.title,
    sourceUrl: values.sourceUrl ?? null,
    storageKey: values.storageKey ?? null,
  });

  await sourceRepository.update(created.id, botId, { status: "processing" });

  let rawText: string;
  try {
    rawText = await getRawText();
  } catch (error) {
    const message =
      error instanceof SourceContentError
        ? error.message
        : "Could not read this source. Try again.";
    if (!(error instanceof SourceContentError)) {
      console.error("[sourceService] extraction failed", created.id, error);
    }
    const failed = await sourceRepository.update(created.id, botId, { status: "failed", error: message });
    return toSource(failed ?? created);
  }

  const finalRow = await ingestSource(created, rawText);
  return toSource(finalRow);
}

async function getRawTextForReindex(source: SourceRow): Promise<string> {
  if (source.type === "url") {
    if (!source.sourceUrl) {
      throw new SourceContentError("This source has no URL to re-fetch.");
    }
    return extractTextFromHtml(await fetchUrlHtml(source.sourceUrl));
  }

  if (!source.storageKey) {
    throw new SourceContentError("This source has no stored content to reindex.");
  }

  const bytes = await downloadFromChatBucket(source.storageKey);

  if (source.type === "file") {
    const extension = extensionFromFilename(source.storageKey);
    if (!isAllowedSourceFileExtension(extension)) {
      throw new SourceContentError("This file's format is no longer supported.");
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
        { type: "url", title: urlTitle(parsed.url), sourceUrl: parsed.url },
        async () => extractTextFromHtml(await fetchUrlHtml(parsed.url)),
      );
    }

    if (parsed.type === "text") {
      const storageKey = `sources/${botId}/${randomUUID()}/content.txt`;
      await uploadTextBlob(storageKey, parsed.content);
      return createAndProcess(
        botId,
        { type: "text", title: parsed.title.slice(0, SOURCE_TITLE_MAX), storageKey },
        () => Promise.resolve(parsed.content),
      );
    }

    const combined = `Q: ${parsed.question}\nA: ${parsed.answer}`;
    const storageKey = `sources/${botId}/${randomUUID()}/content.txt`;
    await uploadTextBlob(storageKey, combined);
    return createAndProcess(
      botId,
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
      { type: "file", title: title.slice(0, SOURCE_TITLE_MAX), storageKey },
      () => extractTextForFile(bytes, extension),
    );
  },

  async remove(botId: string, accountId: string, sourceId: string): Promise<boolean> {
    const bot = await requireOwnedBot(botId, accountId);
    if (!bot) return false;
    const removed = await sourceRepository.remove(sourceId, botId);
    // Removing a source is a knowledge change too — drop any cached answers
    // that might have leaned on it.
    if (removed) await invalidateAnswerCache(botId);
    return removed;
  },

  async reindex(botId: string, accountId: string, sourceId: string): Promise<Source | null> {
    const bot = await requireOwnedBot(botId, accountId);
    if (!bot) return null;

    const source = await sourceRepository.findOwned(sourceId, botId);
    if (!source) return null;

    await sourceRepository.update(sourceId, botId, { status: "processing", error: null });

    let rawText: string;
    try {
      rawText = await getRawTextForReindex(source);
    } catch (error) {
      const message =
        error instanceof SourceContentError ? error.message : "Could not re-read this source. Try again.";
      if (!(error instanceof SourceContentError)) {
        console.error("[sourceService.reindex] extraction failed", source.id, error);
      }
      const failed = await sourceRepository.update(sourceId, botId, { status: "failed", error: message });
      return toSource(failed ?? source);
    }

    const finalRow = await ingestSource(source, rawText);
    return toSource(finalRow);
  },
};

export { SourceValidationError } from "./errors";
