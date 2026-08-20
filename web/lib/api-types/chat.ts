/**
 * Wire types for `POST /api/bots/:botId/chat`. Mirrors the `AnswerEvent`
 * shape from `server/services/answer/types.ts` plus the one thing the answer
 * layer does not know about: which conversation this turn belongs to.
 */

export type ChatTurnRequest = {
  /** Omit to start a new conversation. */
  conversationId?: string;
  message: string;
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
  | { type: "done"; answered: boolean; usage: ChatUsage; citations: ChatCitation[] }
  | { type: "error"; code: string; message: string };
