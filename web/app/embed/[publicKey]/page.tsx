import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { logRefusal } from "server/observability/log";
import { botRepository } from "server/repositories/bot.repository";
import { checkEmbedAccess } from "server/services/widget/origin";
import { resolveBubblePosition, resolveWidgetTheme } from "server/services/widget/theme";
import { EmbedClient } from "./embed-client";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ publicKey: string }> };

/** Every refusal wears the panel's own shape — it is rendered inside a 380px iframe. */
function EmbedNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-dvw items-center justify-center p-4">
      <div className="max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-center text-sm text-[var(--muted)] shadow-xl">
        {children}
      </div>
    </div>
  );
}

/**
 * Renders the widget panel for one bot. Theme and greeting are resolved
 * server-side from the public key so the iframe shows a fully themed panel
 * on first paint — no client round trip before the visitor sees anything
 * (PROJECT_SPEC.md §9).
 *
 * This navigation is also where the bot's allowed domains are enforced: it is
 * the only request in the widget's lifetime that the embedding site is a party
 * to, so it is the only one whose headers say which site the visitor is on.
 */
export default async function EmbedPage({ params }: PageProps) {
  const { publicKey } = await params;
  const bot = await botRepository.findByPublicKey(publicKey);

  if (!bot) notFound();

  if (bot.status !== "active") {
    return <EmbedNotice>This assistant is currently unavailable.</EmbedNotice>;
  }

  const requestHeaders = await headers();
  const access = checkEmbedAccess({
    referer: requestHeaders.get("referer"),
    secFetchDest: requestHeaders.get("sec-fetch-dest"),
    allowedDomains: bot.allowedDomains,
  });

  if (!access.allowed) {
    logRefusal("widget.blocked", {
      code: access.reason,
      botId: bot.id,
      route: "embed",
      host: access.host,
    });
    return (
      <EmbedNotice>
        {access.reason === "DOMAIN_NOT_ALLOWED"
          ? "This site is not authorized to use this chat widget."
          : "This chat opens only on a site that has installed it."}
      </EmbedNotice>
    );
  }

  const theme = resolveWidgetTheme(bot.theme, bot.brandingEnabled);

  return (
    <div className="h-dvh w-dvw">
      <EmbedClient
        publicKey={bot.publicKey}
        theme={theme}
        position={resolveBubblePosition(bot.theme)}
        greeting={bot.welcomeMessage}
        leadCaptureEnabled={bot.leadCaptureEnabled}
        fallbackMessage={bot.fallbackMessage}
      />
    </div>
  );
}
