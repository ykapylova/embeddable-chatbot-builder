"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { createSource } from "lib/api-client";
import type { GapItem } from "lib/api-types/gaps";
import { appPaths } from "lib/api-paths";
import { SOURCE_FAQ_ANSWER_MAX_CHARS, SOURCE_FAQ_QUESTION_MAX_CHARS } from "lib/source-defaults";
import { queryKeys } from "lib/query-keys";
import type { Source } from "lib/api-types/source";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function GapRow({ botId, item }: { botId: string; item: GapItem }) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [answered, setAnswered] = useState(false);

  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.question}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
            <span>
              Asked {item.count} time{item.count === 1 ? "" : "s"}
            </span>
            <span>Last asked {formatTime(item.lastAskedAt)}</span>
            {item.sampleConversationId ? (
              <Link
                href={appPaths.botConversation(botId, item.sampleConversationId)}
                className="underline underline-offset-2"
              >
                View conversation
              </Link>
            ) : null}
          </div>
        </div>

        {answered ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--tone-olive-fg)]">
            <Check className="h-3.5 w-3.5" /> Answered
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setIsComposerOpen((open) => !open)}
          >
            {isComposerOpen ? "Cancel" : "Answer this"}
          </Button>
        )}
      </div>

      {isComposerOpen && !answered ? (
        <GapComposer
          botId={botId}
          question={item.question}
          onDone={() => {
            setAnswered(true);
            setIsComposerOpen(false);
          }}
        />
      ) : null}
    </li>
  );
}

function GapComposer({
  botId,
  question,
  onDone,
}: {
  botId: string;
  question: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [editedQuestion, setEditedQuestion] = useState(question);
  const [answer, setAnswer] = useState("");

  const save = useMutation({
    mutationFn: () =>
      createSource(botId, {
        type: "faq",
        question: editedQuestion.trim(),
        answer: answer.trim(),
      }),
    onSuccess: (source: Source) => {
      queryClient.setQueryData<Source[]>(queryKeys.sources.list(botId), (prev) =>
        prev ? [source, ...prev] : [source],
      );
      onDone();
    },
  });

  const canSubmit = editedQuestion.trim().length > 0 && answer.trim().length > 0 && !save.isPending;

  return (
    <form
      className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) save.mutate();
      }}
    >
      <Input
        value={editedQuestion}
        onChange={(event) => setEditedQuestion(event.target.value)}
        maxLength={SOURCE_FAQ_QUESTION_MAX_CHARS}
        placeholder="Question"
      />
      <textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        maxLength={SOURCE_FAQ_ANSWER_MAX_CHARS}
        rows={4}
        autoFocus
        placeholder="The answer, written the way you'd want it read back."
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs outline-none transition focus:border-[#c9d0dd]"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {save.isPending ? "Saving…" : "Save as FAQ"}
        </Button>
        {save.isError ? (
          <span className="text-xs text-red-600">
            {save.error instanceof Error ? save.error.message : "Could not save this FAQ"}
          </span>
        ) : null}
      </div>
    </form>
  );
}
