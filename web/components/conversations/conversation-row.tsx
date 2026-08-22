import Link from "next/link";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import type { ConversationListItem } from "lib/api-types/conversation";
import { appPaths } from "lib/api-paths";
import { TagPill } from "components/ui/tag-pill";
import { ConversationChannelBadge } from "components/conversations/conversation-channel-badge";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * `pageUrl` is shown as-is (it is a page the visitor was on, not a visitor
 * identifier) — `visitorId` itself is pseudonymous and never rendered here.
 */
export function ConversationRow({ botId, item }: { botId: string; item: ConversationListItem }) {
  return (
    <li>
      <Link
        href={appPaths.botConversation(botId, item.id)}
        className="block p-4 transition hover:bg-[var(--panel-soft)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {item.firstQuestion ?? <span className="text-[var(--muted)]">No question yet</span>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
              <ConversationChannelBadge channel={item.channel} />
              <span>{item.messageCount} messages</span>
              {item.upvotes > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" /> {item.upvotes}
                </span>
              ) : null}
              {item.downvotes > 0 ? (
                <span className="inline-flex items-center gap-1 text-[var(--danger)]">
                  <ThumbsDown className="h-3 w-3" /> {item.downvotes}
                </span>
              ) : null}
              {item.unresolved ? (
                <TagPill tone="amber" className="px-2 py-0.5">
                  Unresolved
                </TagPill>
              ) : null}
              {item.pageUrl ? <span className="truncate">{item.pageUrl}</span> : null}
            </div>
          </div>
          <span className="shrink-0 text-xs whitespace-nowrap text-[var(--muted)]">
            {formatTime(item.lastMessageAt)}
          </span>
        </div>
      </Link>
    </li>
  );
}
