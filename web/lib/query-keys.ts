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
  gaps: {
    list: (botId: string) => ["gaps", botId] as const,
  },
  leads: {
    list: (botId: string) => ["leads", botId] as const,
  },
  plan: {
    self: ["plan"] as const,
  },
  billing: {
    plans: ["billing", "plans"] as const,
    sessionStatus: (sessionId: string) => ["billing", "session-status", sessionId] as const,
  },
} as const;
