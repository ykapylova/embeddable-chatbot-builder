"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";

import { getLeads } from "lib/api-client";
import { queryKeys } from "lib/query-keys";
import { ExportLeadsButton } from "components/leads/export-leads-button";
import { LeadRow } from "components/leads/lead-row";
import { Button } from "components/ui/button";

function Header({ botId }: { botId: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-lg font-medium">Leads</h1>
      <ExportLeadsButton botId={botId} />
    </div>
  );
}

export function LeadsPage({ botId }: { botId: string }) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.leads.list(botId),
    queryFn: ({ pageParam }) => getLeads(botId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Header botId={botId} />
        <LeadsSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-4">
        <Header botId={botId} />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
          <p className="text-sm text-[var(--danger)]">
            {query.error instanceof Error ? query.error.message : "Could not load leads"}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const items = query.data.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <Header botId={botId} />
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center">
          <Mail className="mx-auto mb-3 h-8 w-8 text-[var(--muted)]" />
          <h2 className="text-base font-medium">No leads yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">
            When a visitor leaves their email after the bot couldn&apos;t help, they&apos;ll show up
            here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header botId={botId} />
      <div className="space-y-3">
        <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
          {items.map((item) => (
            <LeadRow key={item.id} botId={botId} item={item} />
          ))}
        </ul>

        {query.hasNextPage ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LeadsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="h-16 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)]" />
      ))}
    </div>
  );
}
