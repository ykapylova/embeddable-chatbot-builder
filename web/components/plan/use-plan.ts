"use client";

import { useQuery } from "@tanstack/react-query";

import { getPlan } from "lib/api-client";
import { queryKeys } from "lib/query-keys";

/**
 * The one place components read plan and usage from. `isPlanResolved` is
 * false only until the first response lands — callers must show a skeleton
 * during that window rather than defaulting to "Free", or a paying account
 * sees a blocked interface flash on sign-in (PROJECT_SPEC.md §10.5).
 */
export function usePlan() {
  const query = useQuery({
    queryKey: queryKeys.plan.self,
    queryFn: getPlan,
    staleTime: 60_000,
  });

  return {
    plan: query.data ?? null,
    isPlanResolved: query.isSuccess,
    isLoading: query.isPending,
    error: query.isError ? (query.error instanceof Error ? query.error.message : "Could not load plan") : null,
    refetch: query.refetch,
  };
}
