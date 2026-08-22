"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";

import { getConversations } from "lib/api-client";
import type { ConversationListFilter } from "lib/api-types/conversation";
import { queryKeys } from "lib/query-keys";
import { ConversationRow } from "components/conversations/conversation-row";
import { Button } from "components/ui/button";

export function ConversationList({ botId, filter }: { botId: string; filter: ConversationListFilter }) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.conversations.list(botId, filter),
    queryFn: ({ pageParam }) => getConversations(botId, filter, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  if (query.isPending) return <ConversationListSkeleton />;

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
        <p className="text-sm text-[var(--danger)]">
          {query.error instanceof Error ? query.error.message : "Could not load conversations"}
        </p>
        <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const items = query.data.pages.flatMap((page) => page.items);
  const hiddenByRetention = query.data.pages[0]?.hiddenByRetention ?? 0;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center">
        <MessageCircle className="mx-auto mb-3 h-8 w-8 text-[var(--muted)]" />
        <h2 className="text-base font-medium">No conversations match this view</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">
          Conversations from the playground and the embedded widget will show up here once visitors
          start chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
        {items.map((item) => (
          <ConversationRow key={item.id} botId={botId} item={item} />
        ))}
      </ul>

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}

      {hiddenByRetention > 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-3 text-center text-xs text-[var(--muted)]">
          {hiddenByRetention} older {hiddenByRetention === 1 ? "conversation is" : "conversations are"} hidden
          — your plan keeps history for a limited window. Upgrade to see further back.
        </p>
      ) : null}
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="h-16 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)]" />
      ))}
    </div>
  );
}
