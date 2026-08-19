export const apiPaths = {
  bots: () => "/api/bots",
  bot: (botId: string) => `/api/bots/${botId}`,
} as const;

export const appPaths = {
  dashboard: () => "/dashboard",
  bot: (botId: string) => `/bots/${botId}`,
  botSettings: (botId: string) => `/bots/${botId}/settings`,
} as const;
