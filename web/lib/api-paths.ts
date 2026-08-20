export const apiPaths = {
  bots: () => "/api/bots",
  bot: (botId: string) => `/api/bots/${botId}`,
  sources: (botId: string) => `/api/bots/${botId}/sources`,
  source: (botId: string, sourceId: string) => `/api/bots/${botId}/sources/${sourceId}`,
  sourceReindex: (botId: string, sourceId: string) =>
    `/api/bots/${botId}/sources/${sourceId}/reindex`,
  retrievalDebug: (botId: string) => `/api/bots/${botId}/retrieval/debug`,
} as const;

export const appPaths = {
  dashboard: () => "/dashboard",
  bot: (botId: string) => `/bots/${botId}`,
  botSettings: (botId: string) => `/bots/${botId}/settings`,
  botKnowledge: (botId: string) => `/bots/${botId}/knowledge`,
} as const;
