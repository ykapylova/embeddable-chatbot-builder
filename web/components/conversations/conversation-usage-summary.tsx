"use client";

import { useQuery } from "@tanstack/react-query";

import { getConversationUsage } from "lib/api-client";
import { queryKeys } from "lib/query-keys";
import { cn } from "lib/utils";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = Math.min(100, (used / limit) * 100);
  const isOverLimit = used > limit;

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className={isOverLimit ? "font-medium text-red-600" : "text-[var(--foreground)]"}>
          {label}: {formatNumber(used)} of {formatNumber(limit)}
        </span>
        {isOverLimit ? <span className="text-xs text-red-600">Over plan limit</span> : null}
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-soft)]">
        <div
          className={cn("h-full rounded-full", isOverLimit ? "bg-red-600" : "bg-[var(--accent)]")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function ConversationUsageSummary({ botId }: { botId: string }) {
  const usage = useQuery({
    queryKey: queryKeys.conversations.usage(botId),
    queryFn: () => getConversationUsage(botId),
  });

  if (usage.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2" aria-hidden>
        <div className="h-10 animate-pulse rounded-lg bg-[var(--panel-soft)]" />
        <div className="h-10 animate-pulse rounded-lg bg-[var(--panel-soft)]" />
      </div>
    );
  }

  if (usage.isError) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 text-sm text-red-600">
        Could not load usage.{" "}
        <button type="button" className="underline underline-offset-2" onClick={() => usage.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  if (!usage.data) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <UsageBar label="Credits this period" used={usage.data.creditsUsed} limit={usage.data.creditsLimit} />
        <UsageBar label="Knowledge base" used={usage.data.kbChars} limit={usage.data.kbCharsLimit} />
      </div>
    </div>
  );
}
