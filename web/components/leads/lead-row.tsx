import Link from "next/link";

import type { LeadListItem } from "lib/api-types/leads";
import { appPaths } from "lib/api-paths";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function LeadRow({ botId, item }: { botId: string; item: LeadListItem }) {
  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.email}</p>
          {item.name ? <p className="text-xs text-[var(--muted)]">{item.name}</p> : null}
          {item.question ? (
            <p className="mt-1 truncate text-sm text-[var(--foreground)]">
              &ldquo;{item.question}&rdquo;
            </p>
          ) : null}
          {item.conversationId ? (
            <Link
              href={appPaths.botConversation(botId, item.conversationId)}
              className="mt-1 inline-block text-xs underline underline-offset-2"
            >
              View conversation
            </Link>
          ) : null}
        </div>
        <span className="shrink-0 text-xs whitespace-nowrap text-[var(--muted)]">
          {formatTime(item.createdAt)}
        </span>
      </div>
    </li>
  );
}
