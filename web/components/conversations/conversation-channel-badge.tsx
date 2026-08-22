import { Code2, MessageSquare } from "lucide-react";

import type { ConversationChannel } from "lib/api-types/conversation";
import { TagPill, type TagPillProps } from "components/ui/tag-pill";

const CHANNEL_TONE: Record<ConversationChannel, NonNullable<TagPillProps["tone"]>> = {
  app: "neutral",
  widget: "violet",
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
    <TagPill tone={CHANNEL_TONE[channel]} className="px-2 py-0.5">
      <Icon className="h-3 w-3" />
      {CHANNEL_LABEL[channel]}
    </TagPill>
  );
}
