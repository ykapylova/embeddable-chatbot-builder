import Link from "next/link";
import { Upload } from "lucide-react";

import { Button } from "components/ui/button";

export const metadata = { title: "Playground — Docsy" };

// Chat arrives in phase 4, the knowledge base in phase 2. Until then the page
// says what is missing instead of showing an empty shell.
export default async function BotPlaygroundPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;

  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center">
      <Upload className="mx-auto mb-3 h-8 w-8 text-[var(--muted)]" />
      <h2 className="text-base font-medium">This bot has no knowledge yet</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">
        Upload your docs and the bot will answer questions about them here.
      </p>
      <Link href={`/bots/${botId}/settings`}>
        <Button variant="outline" className="mt-4">
          Configure this bot
        </Button>
      </Link>
    </div>
  );
}
