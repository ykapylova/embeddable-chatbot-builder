import { BotDataPrefetch } from "components/bots/bot-data-prefetch";
import { BotHeader } from "components/bots/bot-header";
import { BotNav } from "components/bots/bot-nav";

export default async function BotLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;

  return (
    <div className="mx-auto max-w-4xl px-2 py-6 sm:px-4 sm:py-8">
      <BotDataPrefetch botId={botId} />
      <BotHeader botId={botId} />
      <BotNav botId={botId} />
      <div className="pt-6">{children}</div>
    </div>
  );
}
