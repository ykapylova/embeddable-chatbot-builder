"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getConversationUsage,
  getConversations,
  getGaps,
  getLeads,
  getPlan,
  getSources,
} from "lib/api-client";
import type { ConversationListResponse } from "lib/api-types/conversation";
import type { LeadListResponse } from "lib/api-types/leads";
import { queryKeys } from "lib/query-keys";

/**
 * Warms every tab's data the first time a bot is opened, so switching tabs
 * renders from cache instead of starting a request and showing a skeleton.
 *
 * It costs one round of requests per bot visit for tabs the reviewer may never
 * open — the deliberate trade for tab switches that are instant rather than
 * merely fast. Nothing here competes with the tab actually on screen: React
 * runs child effects before the layout's, so that tab's own query is already
 * in flight, and React Query deduplicates the second request against it.
 *
 * `bots.detail` is absent on purpose: the bot header fetches it on every tab
 * already, so it is never the query that is missing.
 */
export function BotDataPrefetch({ botId }: { botId: string }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.sources.list(botId),
      queryFn: () => getSources(botId),
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.conversations.usage(botId),
      queryFn: () => getConversationUsage(botId),
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.gaps.list(botId),
      queryFn: () => getGaps(botId),
    });

    // Appearance, Install and Settings all gate on the plan before they can
    // render anything, so an unwarmed plan holds up three of the seven tabs.
    void queryClient.prefetchQuery({
      queryKey: queryKeys.plan.self,
      queryFn: getPlan,
      staleTime: 60_000,
    });

    void queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.leads.list(botId),
      queryFn: ({ pageParam }) => getLeads(botId, pageParam),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage: LeadListResponse) => lastPage.nextCursor,
    });

    // The empty filter is the state `ConversationsPage` mounts with; a
    // different one here would warm a key nothing ever reads.
    void queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.conversations.list(botId, {}),
      queryFn: ({ pageParam }) => getConversations(botId, {}, pageParam),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage: ConversationListResponse) => lastPage.nextCursor,
    });
  }, [botId, queryClient]);

  return null;
}
