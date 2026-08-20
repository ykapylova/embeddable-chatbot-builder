"use client";

import type { ConversationListFilter } from "lib/api-types/conversation";
import { cn } from "lib/utils";

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </button>
  );
}

export function ConversationFilters({
  filter,
  onChange,
}: {
  filter: ConversationListFilter;
  onChange: (filter: ConversationListFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterPill active={!filter.channel} onClick={() => onChange({ ...filter, channel: undefined })}>
        All channels
      </FilterPill>
      <FilterPill
        active={filter.channel === "app"}
        onClick={() => onChange({ ...filter, channel: "app" })}
      >
        Playground
      </FilterPill>
      <FilterPill
        active={filter.channel === "widget"}
        onClick={() => onChange({ ...filter, channel: "widget" })}
      >
        Widget
      </FilterPill>
      <span className="mx-1 w-px shrink-0 self-stretch bg-[var(--border)]" aria-hidden />
      <FilterPill
        active={!!filter.ratedDown}
        onClick={() => onChange({ ...filter, ratedDown: !filter.ratedDown })}
      >
        Rated 👎
      </FilterPill>
      <FilterPill
        active={!!filter.unresolved}
        onClick={() => onChange({ ...filter, unresolved: !filter.unresolved })}
      >
        Unresolved
      </FilterPill>
    </div>
  );
}
