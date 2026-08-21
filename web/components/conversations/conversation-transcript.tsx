"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ExternalLink, MessageSquarePlus, ThumbsDown, ThumbsUp } from "lucide-react";

import { getConversationTranscript } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import type { ConversationMessage } from "lib/api-types/conversation";
import { queryKeys } from "lib/query-keys";
import { cn } from "lib/utils";
import { sessionFromTranscript, writePlaygroundSession } from "components/chat/playground-session";
import { ConversationChannelBadge } from "components/conversations/conversation-channel-badge";
import { Button } from "components/ui/button";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function TranscriptBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className="max-w-[85%]">
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm break-words",
            isUser
              ? "rounded-br-sm bg-[var(--foreground)] text-white"
              : "rounded-bl-sm bg-[var(--panel-soft)] text-[var(--foreground)]",
          )}
        >
          {message.content || <span className="text-[var(--muted)] italic">No reply</span>}

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

        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>{formatTime(message.createdAt)}</span>
          {message.rating === "up" ? (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <ThumbsUp className="h-3 w-3" fill="currentColor" />
            </span>
          ) : null}
          {message.rating === "down" ? (
            <span className="inline-flex items-center gap-1 text-red-600">
              <ThumbsDown className="h-3 w-3" fill="currentColor" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ConversationTranscriptView({
  botId,
  conversationId,
}: {
  botId: string;
  conversationId: string;
}) {
  const router = useRouter();
  const transcript = useQuery({
    queryKey: queryKeys.conversations.detail(botId, conversationId),
    queryFn: () => getConversationTranscript(botId, conversationId),
  });

  function continueInPlayground(messages: ConversationMessage[]) {
    writePlaygroundSession(botId, sessionFromTranscript(conversationId, messages));
    router.push(appPaths.bot(botId));
  }

  return (
    <div className="space-y-4">
      <Link
        href={appPaths.botConversations(botId)}
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="h-4 w-4" />
        All conversations
      </Link>

      {transcript.isPending ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-14 animate-pulse rounded-2xl bg-[var(--panel-soft)]" />
          ))}
        </div>
      ) : null}

      {transcript.isError ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
          <p className="text-sm text-red-600">
            {transcript.error instanceof Error ? transcript.error.message : "Could not load this conversation"}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => transcript.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {transcript.data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ConversationChannelBadge channel={transcript.data.channel} />
            {transcript.data.unresolved ? (
              <span className="rounded-full bg-[var(--chip-amber-bg)] px-2 py-0.5 text-xs font-medium text-[var(--chip-amber-fg)]">
                Unresolved
              </span>
            ) : null}
            {transcript.data.pageUrl ? (
              <span className="text-xs text-[var(--muted)]">from {transcript.data.pageUrl}</span>
            ) : null}

            {/*
              Playground conversations only. A widget conversation belongs to a
              visitor, and typing into it from here would append the owner's
              messages to someone else's transcript.
            */}
            {transcript.data.channel === "app" && transcript.data.messages.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="ms-auto"
                onClick={() => continueInPlayground(transcript.data.messages)}
              >
                <MessageSquarePlus className="h-4 w-4" />
                Continue in playground
              </Button>
            ) : null}
          </div>

          {transcript.data.messages.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">This conversation has no messages.</p>
          ) : (
            <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
              {transcript.data.messages.map((message) => (
                <TranscriptBubble key={message.id} message={message} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
