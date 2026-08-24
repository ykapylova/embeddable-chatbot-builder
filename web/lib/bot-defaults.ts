/**
 * Defaults for a new bot. They live in lib rather than on the server because the
 * creation form shows the same values as placeholders, and UI drifting from the
 * database would be a lie to the user.
 */
export const BOT_DEFAULTS = {
  welcomeMessage: "Hi! Ask me anything about our product.",
  fallbackMessage:
    "I could not find this in our docs. Leave your email and our team will get back to you.",
  tone: "friendly",
} as const;

export const BOT_TONES = [
  { value: "friendly", label: "Friendly", hint: "Warm and conversational" },
  { value: "professional", label: "Professional", hint: "Neutral and precise" },
  { value: "concise", label: "Concise", hint: "Short, to the point" },
] as const;

export type BotTone = (typeof BOT_TONES)[number]["value"];

export const BOT_NAME_MAX = 60;
export const BOT_MESSAGE_MAX = 500;
export const BOT_PROMPT_MAX = 2000;
export const THEME_PLACEHOLDER_MAX = 80;

/**
 * What a bot with an untouched `theme` column renders as:
 * `server/services/widget/theme.ts` falls back to these, so the appearance
 * form, its preview and the playground all start from the same values.
 */
export const THEME_DEFAULTS = {
  accentColor: "#e85c7b",
  placeholder: "Ask a question…",
} as const;
