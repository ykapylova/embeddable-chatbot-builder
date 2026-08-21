import { createHash } from "node:crypto";

import type { ChatCitation } from "lib/api-types/chat";
import { answerCacheRepository, type CachedAnswer } from "server/repositories/answer-cache.repository";

export type { CachedAnswer };

type HistoryMessage = { role: "user" | "assistant"; content: string };

/**
 * Collapses the surface differences between two ways of asking the same thing —
 * case, spacing, and trailing punctuation — so "What are your hours?" and
 * "what are your hours" share a cache entry. It deliberately does no stemming or
 * synonym work: a false cache miss just costs one model call, but a false hit
 * would serve one question's answer to a different question.
 */
export function normalizeQuestion(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s?!.,;:]+$/u, "")
    .trim();
}

export function hashQuestion(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * The cache answers a standalone question only. A conversation that already has
 * turns can ask "what about the annual plan?", whose meaning lives entirely in
 * the earlier messages — the same words mean different things in different
 * threads, so a shared answer would be wrong.
 */
export function isCacheEligible(history: HistoryMessage[]): boolean {
  return history.length === 0;
}

/** A cached answer for a repeated standalone question, or null to answer live. */
export async function lookupCachedAnswer(
  botId: string,
  question: string,
  history: HistoryMessage[],
): Promise<CachedAnswer | null> {
  if (!isCacheEligible(history)) return null;
  const normalized = normalizeQuestion(question);
  if (!normalized) return null;
  return answerCacheRepository.get(botId, hashQuestion(normalized));
}

/**
 * Stores a freshly generated answer for reuse. Only grounded answers are
 * cached: an "I don't know" is left out on purpose, so adding the missing
 * source later is enough to fix it even before the cache is invalidated.
 */
export async function storeCachedAnswer(
  botId: string,
  question: string,
  history: HistoryMessage[],
  answer: string,
  citations: ChatCitation[],
): Promise<void> {
  if (!isCacheEligible(history)) return;
  if (citations.length === 0) return;
  const normalized = normalizeQuestion(question);
  if (!normalized) return;
  await answerCacheRepository.put(botId, hashQuestion(normalized), normalized, answer, citations);
}

/** Clears a bot's cache. Called whenever its knowledge changes, so a stale
 * answer never outlives the source it was drawn from. */
export async function invalidateAnswerCache(botId: string): Promise<void> {
  await answerCacheRepository.deleteByBot(botId);
}
