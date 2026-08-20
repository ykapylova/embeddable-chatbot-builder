import type { ConversationListFilter } from "lib/api-types/conversation";

export const queryKeys = {
  bots: {
    all: ["bots"] as const,
    detail: (botId: string) => ["bot", botId] as const,
  },
  sources: {
    list: (botId: string) => ["sources", botId] as const,
  },
  conversations: {
    list: (botId: string, filter: ConversationListFilter) => ["conversations", botId, filter] as const,
    usage: (botId: string) => ["conversations", botId, "usage"] as const,
    detail: (botId: string, conversationId: string) =>
      ["conversation", botId, conversationId] as const,
  },
} as const;
