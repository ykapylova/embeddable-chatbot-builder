/**
 * Wire types for `POST /api/bots/:botId/chat`. Mirrors the `AnswerEvent`
 * shape from `server/services/answer/types.ts` plus the one thing the answer
 * layer does not know about: which conversation this turn belongs to.
 */

export type ChatTurnRequest = {
  /** Omit to start a new conversation. */
  conversationId?: string;
  message: string;
  /**
   * Idempotency key for this turn. Stable across the client's own Retry, so
   * the server replays the stored answer instead of generating a second one.
   */
  requestId?: string;
};

export type ChatCitation = {
  index: number;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string | null;
};

export type ChatUsage = {
  tokens: number;
  credits: number;
};

export type ChatStreamEvent =
  | { type: "start"; conversationId: string; citations: ChatCitation[] }
  | { type: "delta"; text: string }
  /**
   * `start` carries every retrieved source so citations can be shown while the
   * answer streams; `done` narrows that to the ones the finished answer cited.
   */
  | {
      type: "done";
      // Row id of the answer as it was stored. The client only ever mints the
      // turn's idempotency key, so without this it cannot name the message it
      // is rating and every rating lands on a row that does not exist.
      messageId: string;
      answered: boolean;
      usage: ChatUsage;
      citations: ChatCitation[];
    }
  | { type: "error"; code: string; message: string };
