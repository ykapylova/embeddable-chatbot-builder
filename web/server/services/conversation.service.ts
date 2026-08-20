import type { ChatCitation } from "lib/api-types/chat";
import type {
  ConversationListFilter,
  ConversationListItem,
  ConversationListResponse,
  ConversationMessage,
  ConversationTranscript,
  ConversationUsageSummary,
} from "lib/api-types/conversation";
import { planLimits, type PlanId } from "lib/plans";
import { botRepository } from "server/repositories/bot.repository";
import {
  conversationRepository,
  type ConversationCursor,
  type ConversationRow,
  type MessageRow,
} from "server/repositories/conversation.repository";
import { sourceRepository } from "server/repositories/source.repository";

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export function encodeCursor(row: Pick<ConversationRow, "lastMessageAt" | "id">): string {
  return Buffer.from(`${row.lastMessageAt}|${row.id}`, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): ConversationCursor | null {
  try {
    const [lastMessageAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!lastMessageAt || !id) return null;
    return { lastMessageAt, id };
  } catch {
    return null;
  }
}

export function retentionCutoff(historyDays: number): string {
  return new Date(Date.now() - historyDays * DAY_MS).toISOString();
}

export function startOfCurrentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function toRating(value: number | null): "up" | "down" | null {
  if (value === 1) return "up";
  if (value === -1) return "down";
  return null;
}

function toTranscriptMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    citations: (row.citations as ChatCitation[] | null) ?? [],
    rating: toRating(row.rating),
    createdAt: row.createdAt,
  };
}

export const conversationService = {
  /**
   * Cursor-paginated so a busy bot's history never comes back as one huge
   * page. `plan` decides both the retention cutoff and the older-history
   * count shown as an upgrade note — always from `PLAN_LIMITS`, per
   * CLAUDE.md §9.
   */
  async list(
    botId: string,
    accountId: string,
    plan: PlanId,
    filter: ConversationListFilter,
    cursorParam: string | null,
  ): Promise<ConversationListResponse | null> {
    const bot = await botRepository.findOwned(botId, accountId);
    if (!bot) return null;

    const cutoff = retentionCutoff(planLimits(plan).historyDays);
    const cursor = cursorParam ? decodeCursor(cursorParam) : null;

    const { rows, hasMore } = await conversationRepository.listPage(botId, {
      limit: PAGE_SIZE,
      cursor,
      cutoff,
      filter,
    });

    const ids = rows.map((row) => row.id);
    const [stats, firstQuestions, hiddenByRetention] = await Promise.all([
      conversationRepository.messageStats(ids),
      conversationRepository.firstQuestions(ids),
      conversationRepository.countBeforeCutoff(botId, cutoff),
    ]);

    const items: ConversationListItem[] = rows.map((row) => {
      const stat = stats.get(row.id) ?? { messageCount: 0, upvotes: 0, downvotes: 0 };
      return {
        id: row.id,
        channel: row.channel,
        firstQuestion: firstQuestions.get(row.id) ?? null,
        messageCount: stat.messageCount,
        upvotes: stat.upvotes,
        downvotes: stat.downvotes,
        pageUrl: row.pageUrl,
        unresolved: row.unresolved,
        createdAt: row.createdAt,
        lastMessageAt: row.lastMessageAt,
      };
    });

    const last = rows[rows.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last) : null,
      hiddenByRetention,
    };
  },

  async transcript(
    botId: string,
    accountId: string,
    conversationId: string,
  ): Promise<ConversationTranscript | null> {
    const bot = await botRepository.findOwned(botId, accountId);
    if (!bot) return null;

    const conversation = await conversationRepository.findOwned(conversationId, botId);
    if (!conversation) return null;

    const messages = await conversationRepository.listMessages(conversationId);
    return {
      id: conversation.id,
      channel: conversation.channel,
      pageUrl: conversation.pageUrl,
      unresolved: conversation.unresolved,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
      messages: messages.map(toTranscriptMessage),
    };
  },

  async usageSummary(
    botId: string,
    accountId: string,
    plan: PlanId,
  ): Promise<ConversationUsageSummary | null> {
    const bot = await botRepository.findOwned(botId, accountId);
    if (!bot) return null;

    const limits = planLimits(plan);
    const [creditsUsed, sources] = await Promise.all([
      conversationRepository.creditsUsedSince(botId, startOfCurrentMonth()),
      sourceRepository.listByBot(botId),
    ]);
    const kbChars = sources.reduce((sum, source) => sum + source.charCount, 0);

    return {
      plan,
      creditsUsed,
      creditsLimit: limits.credits,
      kbChars,
      kbCharsLimit: limits.chars,
      historyDays: limits.historyDays,
    };
  },
};
