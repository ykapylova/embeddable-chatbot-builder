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

/** Everything needed to put a conversation back on screen and carry on with it. */
export type ChatSession = {
  /** Absent until the first turn comes back — the server mints the id. */
  conversationId?: string;
  messages: ChatMessage[];
};

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
  /**
   * Conversation to open with, instead of an empty surface. Read once, on
   * mount — remount the component (a changing `key`) to start over.
   */
  initialSession?: ChatSession;
  /**
   * Fired whenever the surface settles, so a caller that outlives it can put
   * the conversation back. The playground uses this; the widget deliberately
   * does not, and starts fresh on every page load.
   */
  onSessionChange?: (session: ChatSession) => void;
  className?: string;
};
