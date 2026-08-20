import { ConversationsPage } from "components/conversations/conversations-page";

export const metadata = { title: "Conversations — Docsy" };

export default async function BotConversationsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  return <ConversationsPage botId={botId} />;
}
