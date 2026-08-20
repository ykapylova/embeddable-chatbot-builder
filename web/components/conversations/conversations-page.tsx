"use client";

import { useState } from "react";

import type { ConversationListFilter } from "lib/api-types/conversation";
import { ConversationFilters } from "components/conversations/conversation-filters";
import { ConversationList } from "components/conversations/conversation-list";
import { ConversationUsageSummary } from "components/conversations/conversation-usage-summary";

export function ConversationsPage({ botId }: { botId: string }) {
  const [filter, setFilter] = useState<ConversationListFilter>({});

  return (
    <div className="space-y-6">
      <ConversationUsageSummary botId={botId} />
      <ConversationFilters filter={filter} onChange={setFilter} />
      <ConversationList botId={botId} filter={filter} />
    </div>
  );
}
