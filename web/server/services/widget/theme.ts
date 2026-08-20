import type { ChatTheme } from "components/chat/types";

/**
 * Appearance customisation (T07) has not landed yet, so `bots.theme` is still
 * `{}` for every bot. Reading it defensively here means the embed page keeps
 * working unchanged once T07 starts writing real values into the same column.
 */
const DEFAULT_ACCENT_COLOR = "#4f46e5";
const DEFAULT_PLACEHOLDER = "Ask a question…";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function resolveWidgetTheme(rawTheme: unknown, brandingEnabled: boolean): ChatTheme {
  const theme = isRecord(rawTheme) ? rawTheme : {};

  return {
    accentColor: typeof theme.accentColor === "string" ? theme.accentColor : DEFAULT_ACCENT_COLOR,
    avatarUrl: typeof theme.avatarUrl === "string" ? theme.avatarUrl : null,
    placeholder: typeof theme.placeholder === "string" ? theme.placeholder : DEFAULT_PLACEHOLDER,
    brandingEnabled,
  };
}
