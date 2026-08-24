import type { ChatTheme } from "components/chat/types";
import { THEME_DEFAULTS } from "lib/bot-defaults";

/**
 * `bots.theme` is untyped JSON and is still `{}` for every bot created before
 * T07, so each field is read defensively. The fallbacks come from
 * `THEME_DEFAULTS` rather than being restated here: the appearance form, its
 * preview and the playground all render from the same constant, and a second
 * copy of these values would let them disagree about what an unconfigured bot
 * looks like.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function resolveWidgetTheme(rawTheme: unknown, brandingEnabled: boolean): ChatTheme {
  const theme = isRecord(rawTheme) ? rawTheme : {};

  return {
    accentColor: typeof theme.accentColor === "string" ? theme.accentColor : THEME_DEFAULTS.accentColor,
    avatarUrl: typeof theme.avatarUrl === "string" ? theme.avatarUrl : null,
    placeholder: typeof theme.placeholder === "string" ? theme.placeholder : THEME_DEFAULTS.placeholder,
    brandingEnabled,
  };
}
