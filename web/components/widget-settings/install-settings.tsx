"use client";

import { useQuery } from "@tanstack/react-query";

import { getBot } from "lib/api-client";
import { queryKeys } from "lib/query-keys";
import { Button } from "components/ui/button";
import { DomainListEditor } from "components/widget-settings/domain-list-editor";
import { InstallSnippet } from "components/widget-settings/install-snippet";

export function InstallSettings({ botId }: { botId: string }) {
  const bot = useQuery({
    queryKey: queryKeys.bots.detail(botId),
    queryFn: () => getBot(botId),
  });

  if (bot.isPending) {
    return (
      <div className="space-y-4" aria-hidden>
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-24 animate-pulse rounded-2xl bg-[var(--panel-soft)]" />
        ))}
      </div>
    );
  }

  if (bot.isError) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
        <p className="text-sm text-red-600">
          {bot.error instanceof Error ? bot.error.message : "Could not load this bot"}
        </p>
        <Button variant="outline" className="mt-3" onClick={() => bot.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-8">
      <section>
        <h2 className="text-sm font-medium">Embed snippet</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Paste this right before <code>&lt;/body&gt;</code> on any page you want the widget on.
        </p>
        <InstallSnippet publicKey={bot.data.publicKey} />
      </section>

      <section>
        <h2 className="text-sm font-medium">Allowed domains</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Only pages on these domains can load the widget with this key — this is what stops anyone
          who finds the snippet from embedding your bot on a site you do not own.
        </p>
        <DomainListEditor botId={botId} domains={bot.data.allowedDomains} />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
        <h2 className="text-sm font-medium">Test it</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add a domain above, paste the snippet into a page on that domain, then reload it — a chat
          bubble appears in the corner set on the{" "}
          <a href={`/bots/${botId}/appearance`} className="underline underline-offset-2">
            Appearance
          </a>{" "}
          tab.
        </p>
      </section>
    </div>
  );
}
