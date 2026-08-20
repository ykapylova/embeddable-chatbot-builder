import { memo, type ComponentProps } from "react";
import { CircleAlert, ExternalLink, RotateCw, ThumbsDown, ThumbsUp } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "lib/utils";
import type { ChatAssistantMessage, ChatMessage, ChatTheme } from "components/chat/types";

const markdownComponents: Components = {
  p: ({ ...props }) => <p className="[&:not(:first-child)]:mt-2" {...props} />,
  a: ({ ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    />
  ),
  ul: ({ ...props }) => <ul className="mt-2 list-disc space-y-1 pl-5" {...props} />,
  ol: ({ ...props }) => <ol className="mt-2 list-decimal space-y-1 pl-5" {...props} />,
  code: ({ className, ...props }: ComponentProps<"code">) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <code className={cn("font-mono text-[13px]", className)} {...props} />
    ) : (
      <code
        className="rounded bg-[var(--panel-soft)] px-1 py-0.5 font-mono text-[0.85em]"
        {...props}
      />
    );
  },
  pre: ({ ...props }) => (
    <pre
      className="mt-2 overflow-x-auto rounded-xl bg-[var(--panel-soft)] p-3 text-[13px] leading-snug"
      {...props}
    />
  ),
};

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-chat-pulse-soft rounded-full bg-current"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

function FeedbackButtons({
  message,
  onRate,
}: {
  message: ChatAssistantMessage;
  onRate: (rating: "up" | "down") => void;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-1">
      <button
        type="button"
        aria-label="Good answer"
        aria-pressed={message.rating === "up"}
        onClick={() => onRate("up")}
        className={cn(
          "rounded p-1 transition hover:bg-[var(--panel-soft)]",
          message.rating === "up" ? "text-emerald-600" : "text-[var(--muted)]",
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" fill={message.rating === "up" ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        aria-label="Bad answer"
        aria-pressed={message.rating === "down"}
        onClick={() => onRate("down")}
        className={cn(
          "rounded p-1 transition hover:bg-[var(--panel-soft)]",
          message.rating === "down" ? "text-red-600" : "text-[var(--muted)]",
        )}
      >
        <ThumbsDown className="h-3.5 w-3.5" fill={message.rating === "down" ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

function AssistantBubble({
  message,
  onRate,
  onRetry,
}: {
  message: ChatAssistantMessage;
  onRate: (messageId: string, rating: "up" | "down") => void;
  onRetry: (messageId: string) => void;
}) {
  const isFallback = message.status === "done" && !message.answered;
  const isEmpty = message.content.length === 0;

  return (
    <div className="max-w-[85%]">
      <div
        className={cn(
          "rounded-2xl rounded-bl-sm px-3 py-2 text-sm",
          isFallback
            ? "border border-dashed border-[var(--chip-amber-fg)] bg-[var(--chip-amber-bg)] text-[var(--foreground)]"
            : "bg-[var(--panel-soft)] text-[var(--foreground)]",
          message.status === "error" && isEmpty && "border border-red-200 bg-red-50",
        )}
      >
        {isEmpty && message.status === "streaming" ? (
          <TypingIndicator />
        ) : (
          <div className="break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {isFallback ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--chip-amber-fg)]">
            <CircleAlert className="h-3.5 w-3.5 shrink-0" />
            Didn&apos;t find this in the knowledge base — not a guess.
          </p>
        ) : null}

        {message.citations.length > 0 ? (
          <ol className="mt-2 space-y-1 border-t border-[var(--border)] pt-2 text-xs text-[var(--muted)]">
            {message.citations.map((citation) => (
              <li key={citation.sourceId} className="flex items-start gap-1">
                <span className="shrink-0">[{citation.index}]</span>
                {citation.sourceUrl ? (
                  <a
                    href={citation.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-[var(--foreground)]"
                  >
                    {citation.sourceTitle}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span>{citation.sourceTitle}</span>
                )}
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {message.status === "error" ? (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-red-600">
          <span>{message.errorMessage ?? "Something went wrong."}</span>
          <button
            type="button"
            onClick={() => onRetry(message.id)}
            className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
          >
            <RotateCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      ) : null}

      {message.status === "done" ? (
        <FeedbackButtons message={message} onRate={(rating) => onRate(message.id, rating)} />
      ) : null}
    </div>
  );
}

function ChatMessageBubbleImpl({
  message,
  theme,
  onRate,
  onRetry,
}: {
  message: ChatMessage;
  theme: ChatTheme;
  onRate: (messageId: string, rating: "up" | "down") => void;
  onRetry: (messageId: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm break-words text-white"
          style={{ background: theme.accentColor }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <AssistantBubble message={message} onRate={onRate} onRetry={onRetry} />
    </div>
  );
}

/**
 * Memoized so a delta appended to the streaming message only re-renders that
 * one bubble — `ChatSurface` keeps every other message's object reference
 * stable across updates specifically so this comparison stays cheap. `theme`
 * is compared too: the Appearance preview (T07) re-renders every bubble live
 * as the owner edits the accent colour.
 */
export const ChatMessageBubble = memo(
  ChatMessageBubbleImpl,
  (prev, next) => prev.message === next.message && prev.theme === next.theme,
);
