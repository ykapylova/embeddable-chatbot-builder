"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { debugRetrieval } from "lib/api-client";
import type { RetrievalCandidate, RetrievalDebugResponse } from "lib/api-types/retrieval";
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
        Ask a question and see which chunks of your knowledge base would be used to answer it —
        including the ones that came close and were skipped. No answer is generated here.
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

        {search.isSuccess ? (
          <ResultList candidates={search.data.candidates} rule={search.data.rule} />
        ) : null}

        {search.isIdle ? (
          <p className="text-sm text-[var(--muted)]">Results will show up here.</p>
        ) : null}
      </div>
    </div>
  );
}

/** Why the answer path passed this chunk over, in the owner's terms rather than the code's. */
function rejectionLabel(
  candidate: RetrievalCandidate,
  rule: RetrievalDebugResponse["rule"],
): string | null {
  switch (candidate.rejectedBecause) {
    case "below_floor":
      return `Too far off — scored below the ${rule.floor.toFixed(2)} floor`;
    case "outside_margin":
      return `Much weaker than the best match — more than ${rule.margin.toFixed(2)} behind it`;
    case "over_limit":
      return "Good enough, but the answer only gets the top few";
    default:
      return null;
  }
}

function ResultList({
  candidates,
  rule,
}: {
  candidates: RetrievalCandidate[];
  rule: RetrievalDebugResponse["rule"];
}) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
        <p className="text-sm">Nothing in this knowledge base matched at all.</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Not even a weak match — the bot will say &ldquo;I don&apos;t know&rdquo; for this
          question. Add a source that covers it.
        </p>
      </div>
    );
  }

  const kept = candidates.filter((candidate) => candidate.kept);

  return (
    <div className="space-y-3">
      {kept.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-sm">
          Nothing scored high enough to answer with — but these came close. The bot will say
          &ldquo;I don&apos;t know&rdquo;.
        </p>
      ) : null}

      <ul className="space-y-2">
        {candidates.map((candidate) => {
          const rejection = rejectionLabel(candidate, rule);
          return (
            <li
              key={candidate.id}
              className={
                candidate.kept
                  ? "rounded-lg border border-[var(--border)] p-4"
                  : "rounded-lg border border-dashed border-[var(--border)] p-4 opacity-70"
              }
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{candidate.sourceTitle}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={
                      candidate.kept
                        ? "rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-medium"
                        : "rounded-full bg-[var(--panel-soft)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]"
                    }
                  >
                    {candidate.kept ? "Used" : "Skipped"}
                  </span>
                  <span className="rounded-full bg-[var(--panel-soft)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
                    {candidate.score.toFixed(2)}
                  </span>
                </div>
              </div>
              {rejection ? <p className="mt-1 text-xs text-[var(--muted)]">{rejection}</p> : null}
              <p className="mt-2 line-clamp-4 text-sm text-[var(--muted)]">{candidate.content}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
