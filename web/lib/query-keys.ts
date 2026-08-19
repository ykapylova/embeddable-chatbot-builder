export const queryKeys = {
  bots: {
    all: ["bots"] as const,
    detail: (botId: string) => ["bot", botId] as const,
  },
} as const;
