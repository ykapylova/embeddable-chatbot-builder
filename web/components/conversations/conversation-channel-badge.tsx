import { Code2, MessageSquare } from "lucide-react";

import type { ConversationChannel } from "lib/api-types/conversation";
import { cn } from "lib/utils";

const CHANNEL_STYLE: Record<ConversationChannel, string> = {
  app: "bg-[var(--panel-soft)] text-[var(--muted)]",
  widget: "bg-[var(--chip-violet-bg)] text-[var(--chip-violet-fg)]",
};

const CHANNEL_LABEL: Record<ConversationChannel, string> = {
  app: "Playground",
  widget: "Widget",
};

const CHANNEL_ICON: Record<ConversationChannel, React.ComponentType<{ className?: string }>> = {
  app: MessageSquare,
  widget: Code2,
};

export function ConversationChannelBadge({ channel }: { channel: ConversationChannel }) {
  const Icon = CHANNEL_ICON[channel];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        CHANNEL_STYLE[channel],
      )}
    >
      <Icon className="h-3 w-3" />
      {CHANNEL_LABEL[channel]}
    </span>
  );
}
