import { LeadsPage } from "components/leads/leads-page";

export const metadata = { title: "Leads — Docsy" };

export default async function BotLeadsPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  return <LeadsPage botId={botId} />;
}
