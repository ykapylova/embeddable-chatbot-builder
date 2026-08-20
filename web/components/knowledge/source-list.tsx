"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Globe, HelpCircle, RotateCcw, Trash2, Type } from "lucide-react";

import { deleteSource, reindexSource } from "lib/api-client";
import { queryKeys } from "lib/query-keys";
import type { Source, SourceType } from "lib/api-types/source";
import { Button } from "components/ui/button";
import { SourceStatusBadge } from "components/knowledge/source-status-badge";

const TYPE_ICON: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  file: FileText,
  url: Globe,
  text: Type,
  faq: HelpCircle,
};

function formatIndexedAt(source: Source): string {
  if (source.status === "ready" && source.indexedAt) {
    return new Date(source.indexedAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  if (source.status === "failed") return "Not indexed";
  return "Not indexed yet";
}

export function SourceList({ botId, sources }: { botId: string; sources: Source[] }) {
  return (
    <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--panel)]">
      {sources.map((source) => (
        <SourceRow key={source.id} botId={botId} source={source} />
      ))}
    </ul>
  );
}

function SourceRow({ botId, source }: { botId: string; source: Source }) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = TYPE_ICON[source.type];

  const retry = useMutation({
    mutationFn: () => reindexSource(botId, source.id),
    onSuccess: (updated) => {
      queryClient.setQueryData<Source[]>(queryKeys.sources.list(botId), (prev) =>
        prev ? prev.map((item) => (item.id === updated.id ? updated : item)) : prev,
      );
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteSource(botId, source.id),
    onSuccess: () => {
      queryClient.setQueryData<Source[]>(queryKeys.sources.list(botId), (prev) =>
        prev ? prev.filter((item) => item.id !== source.id) : prev,
      );
    },
  });

  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{source.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
              <SourceStatusBadge status={source.status} />
              <span>{source.charCount.toLocaleString()} characters</span>
              <span>{formatIndexedAt(source)}</span>
            </div>
            {source.status === "failed" && source.error ? (
              <p className="mt-1.5 text-xs text-red-600">{source.error}</p>
            ) : null}
            {retry.isError ? (
              <p className="mt-1.5 text-xs text-red-600">
                {retry.error instanceof Error ? retry.error.message : "Retry failed"}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {source.status === "failed" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={retry.isPending}
              onClick={() => retry.mutate()}
            >
              <RotateCcw className={retry.isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              {retry.isPending ? "Retrying…" : "Retry"}
            </Button>
          ) : null}

          {confirmDelete ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? "Deleting…" : "Confirm"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete source"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {confirmDelete ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Answers that rely on this source will change once it is gone. This cannot be undone.
        </p>
      ) : null}

      {remove.isError ? (
        <p className="mt-2 text-xs text-red-600">
          {remove.error instanceof Error ? remove.error.message : "Could not delete this source"}
        </p>
      ) : null}
    </li>
  );
}
