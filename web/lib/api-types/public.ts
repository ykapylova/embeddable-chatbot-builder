/**
 * Wire types for the widget's public surface (`/api/public/*`). These requests
 * carry a bot `publicKey` instead of a session — see PROJECT_SPEC.md §9.
 */

import type { MessageRating } from "lib/api-types/conversation";

export type PublicChatTurnRequest = {
  publicKey: string;
  /** Omit to start a new conversation. */
  conversationId?: string;
  message: string;
  /** Anonymous id the widget keeps in localStorage, purely to stitch a conversation. */
  visitorId: string;
  /** The page the visitor was on when they asked — stored for the owner's transcript view. */
  pageUrl?: string;
  /** Idempotency key for this turn; unchanged when the visitor retries it. */
  requestId?: string;
};

export type PublicFeedbackRequest = {
  publicKey: string;
  conversationId: string;
  visitorId: string;
  /** The stored answer's row id, which the chat stream reports on its done event. */
  messageId: string;
  /** null clears the rating, which is what a thumb pressed twice means. */
  rating: MessageRating | null;
};

export type PublicLeadRequest = {
  publicKey: string;
  conversationId?: string;
  email: string;
  name?: string;
  question?: string;
};

export type PublicWidgetErrorCode =
  | "BOT_NOT_FOUND"
  | "BOT_UNAVAILABLE"
  | "FOREIGN_ORIGIN"
  | "RATE_LIMITED"
  | "CONVERSATION_LIMIT"
  | "LEAD_CAPTURE_DISABLED"
  | "BOT_BUSY";
