import { InstallSettings } from "components/widget-settings/install-settings";

export const metadata = { title: "Install — Docsy" };

export default async function BotInstallPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  return <InstallSettings botId={botId} />;
}
