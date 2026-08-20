"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot as BotIcon, FileText, Plus, ChevronRight, Layers, PauseCircle } from "lucide-react";

import { createBot, getBots } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import { BOT_NAME_MAX } from "lib/bot-defaults";
import { queryKeys } from "lib/query-keys";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { Card } from "components/ui/card";
import { TagPill } from "components/ui/tag-pill";
import { IconBadge } from "components/ui/icon-badge";
import { StatCard } from "components/ui/stat-card";

export function BotsDashboard() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const bots = useQuery({ queryKey: queryKeys.bots.all, queryFn: getBots });

  const create = useMutation({
    mutationFn: createBot,
    onSuccess: async () => {
      setName("");
      setIsCreating(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.bots.all });
    },
  });

  const trimmedName = name.trim();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmedName || create.isPending) return;
    create.mutate({ name: trimmedName });
  }

  const botList = bots.data ?? [];
  const activeCount = botList.filter((bot) => bot.status !== "paused").length;
  const pausedCount = botList.length - activeCount;
  const totalSources = botList.reduce((sum, bot) => sum + bot.sourceCount, 0);

  return (
    <div className="mx-auto max-w-5xl px-2 py-6 sm:px-4 sm:py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your bots</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Each bot has its own knowledge base and its own widget.
          </p>
        </div>

        {!isCreating && bots.data && bots.data.length > 0 ? (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New bot
          </Button>
        ) : null}
      </div>

      {bots.data && bots.data.length > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard tone="amber" label="Bots" value={botList.length} icon={<BotIcon />} />
          <StatCard tone="periwinkle" label="Active" value={activeCount} icon={<Layers />} />
          <StatCard tone="olive" label="Sources" value={totalSources} icon={<FileText />} />
          <StatCard tone="rose" label="Paused" value={pausedCount} icon={<PauseCircle />} />
        </div>
      ) : null}

      {isCreating ? (
        <Card className="mb-6 border border-[var(--border)]">
          <form onSubmit={handleSubmit}>
            <label htmlFor="bot-name" className="mb-2 block text-sm font-medium">
              Bot name
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="bot-name"
                autoFocus
                value={name}
                maxLength={BOT_NAME_MAX}
                placeholder="Acme Support"
                onChange={(event) => setName(event.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={!trimmedName || create.isPending}>
                  {create.isPending ? "Creating…" : "Create"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsCreating(false);
                    setName("");
                    create.reset();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Only you see this name — it is how you tell bots apart.
            </p>
            {create.isError ? (
              <p className="mt-2 text-sm text-red-600">
                {create.error instanceof Error ? create.error.message : "Could not create bot"}
              </p>
            ) : null}
          </form>
        </Card>
      ) : null}

      {bots.isPending ? <BotsSkeleton /> : null}

      {bots.isError ? (
        <Card className="border border-[var(--border)] text-center">
          <p className="text-sm text-red-600">
            {bots.error instanceof Error ? bots.error.message : "Could not load bots"}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => bots.refetch()}>
            Try again
          </Button>
        </Card>
      ) : null}

      {bots.data && bots.data.length === 0 && !isCreating ? (
        <Card className="border border-dashed border-[var(--border)] p-10 text-center">
          <IconBadge tone="neutral" size="lg" className="mx-auto mb-3">
            <BotIcon />
          </IconBadge>
          <h2 className="text-base font-medium">No bots yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
            Create a bot, upload your docs, and embed it on your site.
          </p>
          <Button className="mt-4" onClick={() => setIsCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first bot
          </Button>
        </Card>
      ) : null}

      {bots.data && bots.data.length > 0 ? (
        <Card className="border border-[var(--border)] p-2">
          <ul className="divide-y divide-[var(--border)]">
            {bots.data.map((bot) => (
              <li key={bot.id}>
                <Link
                  href={appPaths.bot(bot.id)}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-[var(--panel-soft)]"
                >
                  <IconBadge tone="amber" size="lg" className="rounded-full">
                    <BotIcon />
                  </IconBadge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{bot.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <TagPill tone={bot.status === "paused" ? "neutral" : "olive"}>
                        {bot.status === "paused" ? "Paused" : "Active"}
                      </TagPill>
                      <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                        <FileText className="h-3 w-3" />
                        {bot.sourceCount === 0
                          ? "No sources yet"
                          : `${bot.sourceCount} source${bot.sourceCount === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function BotsSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-hidden>
      {[0, 1].map((key) => (
        <li key={key} className="h-[92px] animate-pulse rounded-3xl bg-[var(--panel-soft)]" />
      ))}
    </ul>
  );
}
