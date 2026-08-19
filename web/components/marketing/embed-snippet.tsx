"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const SNIPPET = '<script src="https://cdn.docsy.app/widget.js" data-bot="YOUR_BOT_ID" defer></script>';

export function EmbedSnippet() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold sm:text-3xl">One script tag. That&apos;s the integration.</h2>
        <p className="mx-auto mt-3 max-w-lg text-[var(--muted)]">
          Paste it before <code className="text-[var(--foreground)]">&lt;/body&gt;</code>. No build
          step, no SDK, nothing to install.
        </p>

        <div className="mt-8 flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[#0d1117] px-5 py-4 text-left">
          <code className="overflow-x-auto whitespace-pre font-mono text-sm text-[#c9d1d9]">
            {SNIPPET}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-md p-2 text-[#8b949e] transition hover:bg-white/10 hover:text-white"
            aria-label="Copy snippet"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}
