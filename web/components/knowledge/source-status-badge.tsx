import { Loader2 } from "lucide-react";

import type { SourceStatus } from "lib/api-types/source";
import { cn } from "lib/utils";

const STATUS_STYLE: Record<SourceStatus, string> = {
  pending: "bg-[var(--panel-soft)] text-[var(--muted)]",
  processing: "bg-[var(--chip-amber-bg)] text-[var(--chip-amber-fg)]",
  ready: "bg-[var(--chip-teal-bg)] text-[var(--chip-teal-fg)]",
  failed: "bg-[var(--chip-rose-bg)] text-[var(--chip-rose-fg)]",
};

const STATUS_LABEL: Record<SourceStatus, string> = {
  pending: "Queued",
  processing: "Indexing…",
  ready: "Ready",
  failed: "Failed",
};

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
      )}
    >
      {status === "processing" || status === "pending" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : null}
      {STATUS_LABEL[status]}
    </span>
  );
}
