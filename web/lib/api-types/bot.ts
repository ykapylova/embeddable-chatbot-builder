export type BotTheme = {
  accentColor?: string;
  avatarUrl?: string | null;
  placeholder?: string;
  position?: "bottom-right" | "bottom-left";
};

export type Bot = {
  id: string;
  name: string;
  publicKey: string;
  systemPrompt: string | null;
  welcomeMessage: string;
  fallbackMessage: string;
  tone: string;
  theme: BotTheme;
  allowedDomains: string[];
  brandingEnabled: boolean;
  leadCaptureEnabled: boolean;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
};

export type BotListItem = Bot & {
  sourceCount: number;
};

export type CreateBotBody = {
  name: string;
};

export type UpdateBotBody = {
  name?: string;
  systemPrompt?: string | null;
  welcomeMessage?: string;
  fallbackMessage?: string;
  tone?: string;
  theme?: BotTheme;
  allowedDomains?: string[];
  brandingEnabled?: boolean;
  status?: "active" | "paused";
};
