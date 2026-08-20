import { ConversationsGapsTabs } from "./conversations-gaps-tabs";

export const metadata = { title: "Conversations — Docsy" };

export default async function BotConversationsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  return <ConversationsGapsTabs botId={botId} />;
}
