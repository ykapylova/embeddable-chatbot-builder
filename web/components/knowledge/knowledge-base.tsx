"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";

import { getSources } from "lib/api-client";
import { queryKeys } from "lib/query-keys";
import { AddSourcePanel } from "components/knowledge/add-source-panel";
import { KnowledgeCharUsage } from "components/knowledge/knowledge-char-usage";
import { SourceList } from "components/knowledge/source-list";
import { Button } from "components/ui/button";

export function KnowledgeBase({ botId }: { botId: string }) {
  const sources = useQuery({
    queryKey: queryKeys.sources.list(botId),
    queryFn: () => getSources(botId),
    refetchInterval: (query) => (query.state.data?.some((s) => s.status === "processing") ? 2000 : false),
  });

  const totalChars = sources.data?.reduce((sum, source) => sum + source.charCount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <AddSourcePanel botId={botId} />

      {sources.isPending ? <KnowledgeSkeleton /> : null}

      {sources.isError ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
          <p className="text-sm text-red-600">
            {sources.error instanceof Error ? sources.error.message : "Could not load sources"}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => sources.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {sources.data && sources.data.length === 0 ? <EmptyState /> : null}

      {sources.data && sources.data.length > 0 ? (
        <>
          <KnowledgeCharUsage totalChars={totalChars} />
          <SourceList botId={botId} sources={sources.data} />
        </>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center">
      <BookOpen className="mx-auto mb-3 h-8 w-8 text-[var(--muted)]" />
      <h2 className="text-base font-medium">No sources yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">
        A good first source is the page your support team links most — a getting-started guide, a
        pricing FAQ, or your refund policy. The bot only cites documents it actually has: every
        answer links back to one of these, so an empty knowledge base means no citations, and no
        citations means visitors have to guess whether to trust it.
      </p>
    </div>
  );
}

function KnowledgeSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-16 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--panel-soft)]" />
      ))}
    </div>
  );
}
