"use client";

import { useCallback, useRef, useState } from "react";

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
  };
}

/**
 * The one chat implementation for the playground, the widget iframe and the
 * appearance preview (PROJECT_SPEC.md §6). Differences between `variant`s are
 * confined to the container's own classes below — every other branch in this
 * file runs identically for both.
 */
export function ChatSurface({ variant, theme, greeting, sendMessage, onFeedback, className }: ChatSurfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    updateAssistant(messageId, (m) => ({ ...m, rating: m.rating === rating ? null : rating }));
    void onFeedback?.({ messageId, rating });
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
        <p className="border-t border-[var(--border)] py-1.5 text-center text-[11px] text-[var(--muted)]">
          Powered by Docsy
        </p>
      )}
    </div>
  );
}
