import { BotPlayground } from "components/chat/bot-playground";

export const metadata = { title: "Playground — Docsy" };

export default async function BotPlaygroundPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;

  return <BotPlayground botId={botId} />;
}
