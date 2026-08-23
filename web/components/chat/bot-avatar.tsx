"use client";

import { useState } from "react";
import { Bot } from "lucide-react";

/**
 * The bot's face next to its replies. Renders nothing when the owner has not
 * set an avatar, so a bot without one keeps the plain transcript it has always
 * had; a URL that fails to load falls back to a neutral mark rather than the
 * browser's broken-image glyph, because a hole in the transcript reads as a
 * bug in the product rather than a bad setting.
 */
export function BotAvatar({ url }: { url?: string | null }) {
  // Keyed by URL rather than a boolean: the Appearance form edits this value
  // character by character, and each new URL deserves its own attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!url) return null;

  if (failedUrl === url) {
    return (
      <span
        aria-hidden
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--panel-soft)] text-[var(--muted)]"
      >
        <Bot className="h-4 w-4" />
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- the URL is the
       owner's own, from any host; next/image would need every one of them
       configured in next.config. */
    <img
      src={url}
      alt=""
      aria-hidden
      width={28}
      height={28}
      loading="lazy"
      onError={() => setFailedUrl(url)}
      className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover"
    />
  );
}
