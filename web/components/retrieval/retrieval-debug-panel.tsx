"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { debugRetrieval } from "lib/api-client";
import type { RetrievedChunk } from "lib/api-types/retrieval";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";

export function RetrievalDebugPanel({ botId }: { botId: string }) {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState("");

  const search = useMutation({
    mutationFn: (q: string) => debugRetrieval(botId, q),
  });

  function runSearch() {
    const trimmed = question.trim();
    if (!trimmed) return;
    setSubmitted(trimmed);
    search.mutate(trimmed);
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
      <h2 className="text-base font-medium">Test retrieval</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Ask a question and see which chunks of your knowledge base would be used to answer it — no
        answer is generated here.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <Input
          value={question}
          placeholder="Ask a question your bot should know the answer to…"
          maxLength={2000}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Button type="submit" disabled={search.isPending || question.trim().length === 0}>
          <Search className="h-4 w-4" />
          {search.isPending ? "Searching…" : "Search"}
        </Button>
      </form>

      <div className="mt-5">
        {search.isPending ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-16 animate-pulse rounded-lg bg-[var(--panel-soft)]" />
            ))}
          </div>
        ) : null}

        {search.isError ? (
          <div className="rounded-lg border border-[var(--border)] p-4 text-center">
            <p className="text-sm text-red-600">
              {search.error instanceof Error ? search.error.message : "Could not run retrieval"}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => search.mutate(submitted)}>
              Try again
            </Button>
          </div>
        ) : null}

        {search.isSuccess ? <ResultList chunks={search.data.chunks} /> : null}

        {search.isIdle ? (
          <p className="text-sm text-[var(--muted)]">Results will show up here.</p>
        ) : null}
      </div>
    </div>
  );
}

function ResultList({ chunks }: { chunks: RetrievedChunk[] }) {
  if (chunks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
        <p className="text-sm">No relevant chunks found.</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          This is expected when nothing in the knowledge base scores above the relevance cutoff —
          it is exactly what makes the bot say &ldquo;I don&apos;t know&rdquo; instead of guessing.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {chunks.map((chunk) => (
        <li key={chunk.id} className="rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{chunk.sourceTitle}</span>
            <span className="shrink-0 rounded-full bg-[var(--panel-soft)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
              {chunk.score.toFixed(2)}
            </span>
          </div>
          <p className="mt-2 line-clamp-4 text-sm text-[var(--muted)]">{chunk.content}</p>
        </li>
      ))}
    </ul>
  );
}
