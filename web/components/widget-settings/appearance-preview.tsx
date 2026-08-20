"use client";

import { postChatTurn } from "lib/api-client";
import type { BubblePosition } from "lib/bot-defaults";
import { cn } from "lib/utils";
import { ChatSurface } from "components/chat/chat-surface";
import type { ChatTheme } from "components/chat/types";

/**
 * Not a mock: this is `ChatSurface` talking to the real chat endpoint
 * (PROJECT_SPEC.md, "the same ChatSurface rendered directly with the form's
 * values"). Only the surrounding page mockup and the corner it sits in are
 * decoration — the panel itself is the real widget.
 */
export function AppearancePreview({
  botId,
  theme,
  greeting,
  position,
}: {
  botId: string;
  theme: ChatTheme;
  greeting: string;
  position: BubblePosition;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e11d48]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#d97706]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#0f9488]" />
        <span className="ml-2 text-xs text-[var(--muted)]">yoursite.com</span>
      </div>

      <div
        className={cn(
          "flex h-[480px] items-end rounded-md border border-dashed border-[var(--border)] bg-[var(--panel)] p-4",
          position === "bottom-left" ? "justify-start" : "justify-end",
        )}
      >
        <div className="h-[420px] w-[240px]">
          <ChatSurface
            key={botId}
            variant="widget"
            theme={theme}
            greeting={greeting}
            sendMessage={({ message, conversationId, signal }) =>
              postChatTurn(botId, { message, conversationId }, signal)
            }
          />
        </div>
      </div>
    </div>
  );
}
