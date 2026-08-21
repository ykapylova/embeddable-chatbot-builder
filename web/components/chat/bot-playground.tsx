"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bug, RotateCcw } from "lucide-react";

import { getBot, postChatTurn } from "lib/api-client";
import { THEME_DEFAULTS } from "lib/bot-defaults";
import { queryKeys } from "lib/query-keys";
import { ChatSurface } from "components/chat/chat-surface";
import {
  clearPlaygroundSession,
  readPlaygroundSession,
  writePlaygroundSession,
} from "components/chat/playground-session";
import type { ChatSession } from "components/chat/types";
import { RetrievalDebugPanel } from "components/retrieval/retrieval-debug-panel";
import { Button } from "components/ui/button";

/**
 * Owner-facing entry point for `ChatSurface`. Retrieval debugging predates
 * the real chat (T03) and stays behind a toggle here rather than being
 * removed — it is still the fastest way to tell "the bot answered badly"
 * apart from "the bot found nothing to answer with".
 */
export function BotPlayground({ botId }: { botId: string }) {
  const [showDebug, setShowDebug] = useState(false);
  const bot = useQuery({ queryKey: queryKeys.bots.detail(botId), queryFn: () => getBot(botId) });

  /**
   * Read once, lazily. The initializer also runs on the server, where
   * `sessionStorage` does not exist and the read returns null — but the value
   * is not rendered until `bot.data` resolves, which is after hydration, so the
   * two renders cannot disagree about anything on screen.
   */
  const [session, setSession] = useState<ChatSession | null>(() => readPlaygroundSession(botId));
  // Bumped to remount `ChatSurface`, which reads its session once, on mount.
  const [surfaceKey, setSurfaceKey] = useState(0);

  const persistSession = useCallback(
    (next: ChatSession) => writePlaygroundSession(botId, next),
    [botId],
  );

  function startNewChat() {
    clearPlaygroundSession(botId);
    setSession(null);
    setSurfaceKey((key) => key + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">Try the bot the way a visitor would.</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={startNewChat}>
            <RotateCcw className="h-4 w-4" />
            New chat
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDebug((v) => !v)}>
            <Bug className="h-4 w-4" />
            {showDebug ? "Hide retrieval debug" : "Retrieval debug"}
          </Button>
        </div>
      </div>

      {bot.isPending ? (
        <div
          className="h-[560px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)]"
          aria-hidden
        />
      ) : null}

      {bot.isError ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
          <p className="text-sm text-red-600">
            {bot.error instanceof Error ? bot.error.message : "Could not load this bot"}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => bot.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {bot.data ? (
        <div className="h-[560px]">
          <ChatSurface
            key={surfaceKey}
            variant="app"
            theme={{
              accentColor: bot.data.theme.accentColor ?? THEME_DEFAULTS.accentColor,
              avatarUrl: bot.data.theme.avatarUrl ?? null,
              placeholder: bot.data.theme.placeholder ?? THEME_DEFAULTS.placeholder,
              brandingEnabled: bot.data.brandingEnabled,
            }}
            greeting={bot.data.welcomeMessage}
            initialSession={session ?? undefined}
            onSessionChange={persistSession}
            sendMessage={({ message, conversationId, signal }) =>
              postChatTurn(botId, { message, conversationId }, signal)
            }
          />
        </div>
      ) : null}

      {showDebug ? <RetrievalDebugPanel botId={botId} /> : null}
    </div>
  );
}
