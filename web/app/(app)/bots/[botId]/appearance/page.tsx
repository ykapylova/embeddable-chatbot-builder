import { AppearanceForm } from "components/widget-settings/appearance-form";

export const metadata = { title: "Appearance — Docsy" };

export default async function BotAppearancePage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  return <AppearanceForm botId={botId} />;
}
