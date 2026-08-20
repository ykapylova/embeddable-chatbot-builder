import { RetrievalDebugPanel } from "components/retrieval/retrieval-debug-panel";

export const metadata = { title: "Playground — Docsy" };

// Chat itself arrives in phase 4. Until then this is where retrieval — the
// half of the pipeline that runs without a model — can be judged by eye.
export default async function BotPlaygroundPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;

  return <RetrievalDebugPanel botId={botId} />;
}
