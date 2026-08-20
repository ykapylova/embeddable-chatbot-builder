import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { botRepository } from "server/repositories/bot.repository";
import { resolveWidgetTheme } from "server/services/widget/theme";
import { EmbedClient } from "./embed-client";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ publicKey: string }> };

/**
 * Renders the widget panel for one bot. Theme and greeting are resolved
 * server-side from the public key so the iframe shows a fully themed panel
 * on first paint — no client round trip before the visitor sees anything
 * (PROJECT_SPEC.md §9).
 */
export default async function EmbedPage({ params }: PageProps) {
  const { publicKey } = await params;
  const bot = await botRepository.findByPublicKey(publicKey);

  if (!bot) notFound();

  if (bot.status !== "active") {
    return (
      <div className="flex h-dvh w-dvw items-center justify-center p-4">
        <div className="max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-center text-sm text-[var(--muted)] shadow-xl">
          This assistant is currently unavailable.
        </div>
      </div>
    );
  }

  const theme = resolveWidgetTheme(bot.theme, bot.brandingEnabled);

  return (
    <div className="h-dvh w-dvw">
      <EmbedClient
        publicKey={bot.publicKey}
        theme={theme}
        greeting={bot.welcomeMessage}
        leadCaptureEnabled={bot.leadCaptureEnabled}
        fallbackMessage={bot.fallbackMessage}
      />
    </div>
  );
}
