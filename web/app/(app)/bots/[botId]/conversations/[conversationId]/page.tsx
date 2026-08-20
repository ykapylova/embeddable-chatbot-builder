import { ConversationTranscriptView } from "components/conversations/conversation-transcript";

export const metadata = { title: "Transcript — Docsy" };

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ botId: string; conversationId: string }>;
}) {
  const { botId, conversationId } = await params;
  return <ConversationTranscriptView botId={botId} conversationId={conversationId} />;
}
