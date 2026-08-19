"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";

import { getBot } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import { queryKeys } from "lib/query-keys";

export function BotHeader({ botId }: { botId: string }) {
  const bot = useQuery({
    queryKey: queryKeys.bots.detail(botId),
    queryFn: () => getBot(botId),
  });

  return (
    <div className="mb-4">
      <Link
        href={appPaths.dashboard()}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="h-4 w-4" />
        All bots
      </Link>

      {bot.isPending ? (
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--panel-soft)]" aria-hidden />
      ) : null}

      {bot.isError ? (
        <h1 className="text-2xl font-semibold text-red-600">Bot not found</h1>
      ) : null}

      {bot.data ? <h1 className="truncate text-2xl font-semibold">{bot.data.name}</h1> : null}
    </div>
  );
}
