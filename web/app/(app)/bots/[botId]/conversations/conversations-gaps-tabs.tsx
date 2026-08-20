"use client";

import { useState } from "react";

import { cn } from "lib/utils";
import { ConversationsPage } from "components/conversations/conversations-page";
import { GapsPanel } from "components/gaps/gaps-panel";

type Tab = "conversations" | "gaps";

export function ConversationsGapsTabs({ botId }: { botId: string }) {
  const [tab, setTab] = useState<Tab>("conversations");

  return (
    <div className="space-y-6">
      <nav className="flex w-fit gap-1 rounded-full bg-[var(--panel-soft)] p-1">
        <TabButton active={tab === "conversations"} onClick={() => setTab("conversations")}>
          Conversations
        </TabButton>
        <TabButton active={tab === "gaps"} onClick={() => setTab("gaps")}>
          Content gaps
        </TabButton>
      </nav>

      {tab === "conversations" ? <ConversationsPage botId={botId} /> : <GapsPanel botId={botId} />}
    </div>
  );
}

function TabButton({
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
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition",
        active
          ? "bg-[var(--chrome)] font-medium text-[var(--chrome-foreground)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </button>
  );
}
