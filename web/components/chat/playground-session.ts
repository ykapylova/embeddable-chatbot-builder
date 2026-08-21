import type { ConversationMessage } from "lib/api-types/conversation";
import type { ChatMessage, ChatSession } from "components/chat/types";

/**
 * The playground's conversation lives in `ChatSurface`'s state, which every
 * navigation throws away — so leaving the tab and coming back used to start a
 * new conversation on the next question, while the old one sat in Conversations
 * with no way back into it.
 *
 * `sessionStorage`, not `localStorage`: the playground is a scratch pad, and a
 * conversation that outlived the browser would be a surprise rather than a
 * convenience. Keyed per bot, because switching bots is switching subject.
 */
const KEY_PREFIX = "docsy:playground:";

function storageKey(botId: string): string {
  return `${KEY_PREFIX}${botId}`;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<ChatMessage>;
  if (typeof message.id !== "string" || typeof message.content !== "string") return false;
  return message.role === "user" || message.role === "assistant";
}

function isSession(value: unknown): value is ChatSession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Partial<ChatSession>;
  if (session.conversationId !== undefined && typeof session.conversationId !== "string") return false;
  return Array.isArray(session.messages) && session.messages.every(isChatMessage);
}

export function readPlaygroundSession(botId: string): ChatSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(storageKey(botId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    // Corrupt entry, a storage quota, or a browser that refuses storage
    // altogether. None of them is worth breaking the playground over.
    return null;
  }
}

export function writePlaygroundSession(botId: string, session: ChatSession): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(storageKey(botId), JSON.stringify(session));
  } catch {
    // Same reasoning: persistence is a convenience, never a precondition.
  }
}

export function clearPlaygroundSession(botId: string): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(storageKey(botId));
  } catch {
    // Nothing useful to do — the next write overwrites it anyway.
  }
}

/**
 * Turns a stored transcript back into something `ChatSurface` can render and
 * continue. `forQuestion` is the question each answer replied to, which the
 * transcript records only by position, so it is read from the preceding user
 * message — it is what Retry resends.
 */
export function sessionFromTranscript(
  conversationId: string,
  messages: ConversationMessage[],
): ChatSession {
  const restored: ChatMessage[] = [];
  let lastQuestion = "";

  for (const message of messages) {
    if (message.role === "user") {
      lastQuestion = message.content;
      restored.push({ id: message.id, role: "user", content: message.content });
      continue;
    }

    restored.push({
      id: message.id,
      role: "assistant",
      forQuestion: lastQuestion,
      content: message.content,
      status: "done",
      citations: message.citations,
      // Stored messages carry no per-turn `answered` flag — only the
      // conversation has `unresolved`. `true` is the neutral choice: it costs
      // the "couldn't answer" hint on a restored fallback and never adds one
      // that was not there.
      answered: true,
      rating: message.rating,
    });
  }

  return { conversationId, messages: restored };
}
