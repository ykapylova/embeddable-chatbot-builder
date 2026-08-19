import { BotSettingsForm } from "components/bots/bot-settings-form";

export const metadata = { title: "Bot settings — Docsy" };

export default async function BotSettingsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  return <BotSettingsForm botId={botId} />;
}
