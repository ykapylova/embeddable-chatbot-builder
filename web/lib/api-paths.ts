export const apiPaths = {
  bots: () => "/api/bots",
  bot: (botId: string) => `/api/bots/${botId}`,
  sources: (botId: string) => `/api/bots/${botId}/sources`,
  source: (botId: string, sourceId: string) => `/api/bots/${botId}/sources/${sourceId}`,
  sourceReindex: (botId: string, sourceId: string) =>
    `/api/bots/${botId}/sources/${sourceId}/reindex`,
  retrievalDebug: (botId: string) => `/api/bots/${botId}/retrieval/debug`,
  chat: (botId: string) => `/api/bots/${botId}/chat`,
  conversations: (botId: string) => `/api/bots/${botId}/conversations`,
  conversationsUsage: (botId: string) => `/api/bots/${botId}/conversations/usage`,
  conversation: (botId: string, conversationId: string) =>
    `/api/bots/${botId}/conversations/${conversationId}`,
  gaps: (botId: string) => `/api/bots/${botId}/gaps`,
  leads: (botId: string) => `/api/bots/${botId}/leads`,
  leadsExport: (botId: string) => `/api/bots/${botId}/leads/export`,
  mePlan: () => "/api/me/plan",
} as const;

export const appPaths = {
  dashboard: () => "/dashboard",
  bot: (botId: string) => `/bots/${botId}`,
  botSettings: (botId: string) => `/bots/${botId}/settings`,
  botKnowledge: (botId: string) => `/bots/${botId}/knowledge`,
  botAppearance: (botId: string) => `/bots/${botId}/appearance`,
  botInstall: (botId: string) => `/bots/${botId}/install`,
  botConversations: (botId: string) => `/bots/${botId}/conversations`,
  botConversation: (botId: string, conversationId: string) =>
    `/bots/${botId}/conversations/${conversationId}`,
  botLeads: (botId: string) => `/bots/${botId}/leads`,
} as const;
