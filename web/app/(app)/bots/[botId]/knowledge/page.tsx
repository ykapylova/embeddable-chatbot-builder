import { KnowledgeBase } from "components/knowledge/knowledge-base";

export const metadata = { title: "Knowledge base — Docsy" };

export default async function BotKnowledgePage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  return <KnowledgeBase botId={botId} />;
}
