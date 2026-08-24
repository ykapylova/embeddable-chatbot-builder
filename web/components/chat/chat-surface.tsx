"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatStreamEvent } from "lib/api-types/chat";
import { consumeSseJsonStream } from "lib/chat-turn-stream";
import { cn } from "lib/utils";
import { Composer } from "components/chat/composer";
import { MessageList } from "components/chat/message-list";
import type { ChatAssistantMessage, ChatMessage, ChatSurfaceProps } from "components/chat/types";

function freshAssistant(id: string, forQuestion: string): ChatAssistantMessage {
  return {
    id,
    role: "assistant",
    forQuestion,
    content: "",
    status: "streaming",
    citations: [],
    answered: true,
    rating: null,
    storedId: null,
  };
}

/**
 * The one chat implementation for the playground, the widget iframe and the
 * appearance preview (PROJECT_SPEC.md §6). Differences between `variant`s are
 * confined to the container's own classes below — every other branch in this
 * file runs identically for both.
 */
export function ChatSurface({
  variant,
  theme,
  greeting,
  sendMessage,
  onFeedback,
  initialSession,
  onSessionChange,
  className,
}: ChatSurfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession?.messages ?? []);
  const [input, setInput] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | undefined>(initialSession?.conversationId);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reported only once the surface settles. Reporting on every delta would mean
  // a write per token, and a half-streamed message is not a state worth
  // restoring: a turn abandoned mid-stream is left out, still in the transcript
  // and picked up again by whatever is asked next.
  useEffect(() => {
    if (!onSessionChange || streamingId) return;
    if (messages.length === 0 && !conversationIdRef.current) return;

    onSessionChange({ conversationId: conversationIdRef.current, messages });
  }, [messages, streamingId, onSessionChange]);

  const updateAssistant = useCallback(
    (id: string, updater: (message: ChatAssistantMessage) => ChatAssistantMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id && m.role === "assistant" ? updater(m) : m)));
    },
    [],
  );

  const runTurn = useCallback(
    async (question: string, assistantId: string) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setStreamingId(assistantId);

      try {
        const response = await sendMessage({
          message: question,
          conversationId: conversationIdRef.current,
          // The assistant message's id doubles as the turn's idempotency key:
          // `handleRetry` reuses it, `handleSend` mints a new one.
          requestId: assistantId,
          signal: controller.signal,
        });

        await consumeSseJsonStream<ChatStreamEvent>(response, (event) => {
          if (event.type === "start") {
            conversationIdRef.current = event.conversationId;
            updateAssistant(assistantId, (m) => ({ ...m, citations: event.citations }));
          } else if (event.type === "delta") {
            updateAssistant(assistantId, (m) => ({ ...m, content: m.content + event.text }));
          } else if (event.type === "done") {
            updateAssistant(assistantId, (m) => ({
              ...m,
              status: "done",
              answered: event.answered,
              citations: event.citations,
              storedId: event.messageId,
            }));
          } else {
            updateAssistant(assistantId, (m) => ({ ...m, status: "error", errorMessage: event.message }));
          }
        });
      } catch (error) {
        if (controller.signal.aborted) {
          updateAssistant(assistantId, (m) =>
            m.content
              ? { ...m, status: "done" }
              : { ...m, status: "error", errorMessage: "Stopped before answering." },
          );
        } else {
          updateAssistant(assistantId, (m) => ({
            ...m,
            status: "error",
            errorMessage: error instanceof Error ? error.message : "Could not reach the assistant.",
          }));
        }
      } finally {
        abortControllerRef.current = null;
        setStreamingId((current) => (current === assistantId ? null : current));
      }
    },
    [sendMessage, updateAssistant],
  );

  function handleSend() {
    const question = input.trim();
    if (!question || streamingId) return;
    setInput("");

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: question },
      freshAssistant(assistantId, question),
    ]);
    void runTurn(question, assistantId);
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  function handleRetry(assistantId: string) {
    if (streamingId) return;
    const target = messages.find((m) => m.id === assistantId);
    if (!target || target.role !== "assistant") return;

    updateAssistant(assistantId, () => freshAssistant(assistantId, target.forQuestion));
    void runTurn(target.forQuestion, assistantId);
  }

  function handleRate(messageId: string, rating: "up" | "down") {
    const target = messages.find((m) => m.id === messageId);
    if (!target || target.role !== "assistant") return;

    const next = target.rating === rating ? null : rating;
    updateAssistant(messageId, (m) => ({ ...m, rating: next }));

    // The stored row is what the rating attaches to, and it is the server that
    // names it — a turn the database never accepted has nothing to rate.
    const conversationId = conversationIdRef.current;
    if (!conversationId || !target.storedId) return;
    void onFeedback?.({ conversationId, messageId: target.storedId, rating: next });
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-[var(--panel)]",
        variant === "app" ? "rounded-2xl border border-[var(--border)]" : "rounded-2xl border border-[var(--border)] shadow-xl",
        className,
      )}
    >
      <MessageList messages={messages} theme={theme} greeting={greeting} onRate={handleRate} onRetry={handleRetry} />
      <Composer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={streamingId !== null}
        placeholder={theme.placeholder}
        accentColor={theme.accentColor}
      />
      {theme.brandingEnabled === false ? null : (
        <p className="border-t border-[var(--border)] py-1.5 text-center text-xs text-[var(--muted)]">
          Powered by Docsy
        </p>
      )}
    </div>
  );
}
