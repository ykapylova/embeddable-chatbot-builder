import { BotAvatar } from "components/chat/bot-avatar";
import { ChatMessageBubble } from "components/chat/message-bubble";
import type { ChatMessage, ChatTheme, ChatVariant } from "components/chat/types";
import { useAutoscroll } from "components/chat/use-autoscroll";

export function MessageList({
  messages,
  theme,
  variant,
  greeting,
  onRate,
  onRetry,
}: {
  messages: ChatMessage[];
  theme: ChatTheme;
  variant: ChatVariant;
  greeting: string;
  onRate: (messageId: string, rating: "up" | "down") => void;
  onRetry: (messageId: string) => void;
}) {
  const lastMessage = messages[messages.length - 1];
  const { containerRef, handleScroll } = useAutoscroll(
    lastMessage ? `${lastMessage.id}:${lastMessage.role === "assistant" ? lastMessage.content.length : ""}` : "",
  );

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 space-y-3 overflow-y-auto p-3">
      <div className="flex justify-start gap-2">
        <BotAvatar url={theme.avatarUrl} />
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
          {greeting}
        </div>
      </div>

      {messages.map((message) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          theme={theme}
          variant={variant}
          onRate={onRate}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
