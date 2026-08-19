"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot as BotIcon, FileText, Plus } from "lucide-react";

import { createBot, getBots } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import { BOT_NAME_MAX } from "lib/bot-defaults";
import { queryKeys } from "lib/query-keys";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";

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

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your bots</h1>
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

      {isCreating ? (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4"
        >
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
      ) : null}

      {bots.isPending ? <BotsSkeleton /> : null}

      {bots.isError ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
          <p className="text-sm text-red-600">
            {bots.error instanceof Error ? bots.error.message : "Could not load bots"}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => bots.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {bots.data && bots.data.length === 0 && !isCreating ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center">
          <BotIcon className="mx-auto mb-3 h-8 w-8 text-[var(--muted)]" />
          <h2 className="text-base font-medium">No bots yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
            Create a bot, upload your docs, and embed it on your site.
          </p>
          <Button className="mt-4" onClick={() => setIsCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first bot
          </Button>
        </div>
      ) : null}

      {bots.data && bots.data.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {bots.data.map((bot) => (
            <li key={bot.id}>
              <Link
                href={appPaths.bot(bot.id)}
                className="block rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 transition hover:border-[#c9d0dd]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{bot.name}</span>
                  {bot.status === "paused" ? (
                    <span className="shrink-0 rounded-full bg-[var(--panel-soft)] px-2 py-0.5 text-xs text-[var(--muted)]">
                      Paused
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-sm text-[var(--muted)]">
                  <FileText className="h-3.5 w-3.5" />
                  {bot.sourceCount === 0
                    ? "No sources yet"
                    : `${bot.sourceCount} source${bot.sourceCount === 1 ? "" : "s"}`}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function BotsSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-hidden>
      {[0, 1].map((key) => (
        <li
          key={key}
          className="h-[92px] animate-pulse rounded-lg border border-[var(--border)] bg-[var(--panel-soft)]"
        />
      ))}
    </ul>
  );
}
