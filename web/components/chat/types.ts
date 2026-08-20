import type { ChatCitation } from "lib/api-types/chat";

export type ChatVariant = "app" | "widget";

/**
 * Everything ChatSurface needs to look like a specific bot. `theme` fields
 * beyond `accentColor` are optional because most call sites (the playground,
 * early previews) do not have a fully configured bot yet.
 */
export type ChatTheme = {
  accentColor: string;
  avatarUrl?: string | null;
  placeholder?: string;
  brandingEnabled?: boolean;
};

export type ChatUserMessage = {
  id: string;
  role: "user";
  content: string;
};

export type ChatAssistantMessage = {
  id: string;
  role: "assistant";
  /** The question this message answers — resent verbatim on retry. */
  forQuestion: string;
  content: string;
  status: "streaming" | "done" | "error";
  citations: ChatCitation[];
  /** false once the turn finishes if the bot fell back instead of answering. */
  answered: boolean;
  errorMessage?: string;
  rating: "up" | "down" | null;
};

export type ChatMessage = ChatUserMessage | ChatAssistantMessage;

/**
 * Performs one turn and returns the raw SSE `Response` — ChatSurface consumes
 * it with `consumeSseJsonStream`. Kept fetch-agnostic on purpose: the app and
 * the widget call different endpoints with different auth, and ChatSurface
 * must not know which.
 */
export type SendChatMessage = (params: {
  message: string;
  conversationId: string | undefined;
  signal: AbortSignal;
}) => Promise<Response>;

export type ChatFeedback = (params: {
  messageId: string;
  rating: "up" | "down";
}) => void | Promise<void>;

export type ChatSurfaceProps = {
  variant: ChatVariant;
  theme: ChatTheme;
  greeting: string;
  sendMessage: SendChatMessage;
  /**
   * Fired the moment a rating is chosen, after the optimistic UI update.
   * Optional — a caller with nowhere to persist the choice yet can omit it.
   */
  onFeedback?: ChatFeedback;
  className?: string;
};
