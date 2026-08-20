import type { ChatCitation } from "lib/api-types/chat";
import type { PlanId } from "lib/plans";

export type ConversationChannel = "app" | "widget";

export type ConversationListFilter = {
  channel?: ConversationChannel;
  ratedDown?: boolean;
  unresolved?: boolean;
};

export type ConversationListItem = {
  id: string;
  channel: ConversationChannel;
  /** The visitor's first message, or null for a conversation with no reply yet. */
  firstQuestion: string | null;
  messageCount: number;
  upvotes: number;
  downvotes: number;
  pageUrl: string | null;
  unresolved: boolean;
  createdAt: string;
  lastMessageAt: string;
};

export type ConversationListResponse = {
  items: ConversationListItem[];
  /** Opaque cursor for the next page; null once the list is exhausted. */
  nextCursor: string | null;
  /** Conversations older than the plan's retention window, not included above. */
  hiddenByRetention: number;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[];
  rating: "up" | "down" | null;
  createdAt: string;
};

export type ConversationTranscript = {
  id: string;
  channel: ConversationChannel;
  pageUrl: string | null;
  unresolved: boolean;
  createdAt: string;
  lastMessageAt: string;
  messages: ConversationMessage[];
};

export type ConversationUsageSummary = {
  plan: PlanId;
  creditsUsed: number;
  creditsLimit: number;
  kbChars: number;
  kbCharsLimit: number;
  historyDays: number;
};
