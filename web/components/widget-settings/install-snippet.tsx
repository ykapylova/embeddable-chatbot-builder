"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "components/ui/button";

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function InstallSnippet({ publicKey }: { publicKey: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${APP_ORIGIN}/widget.js" data-bot-key="${publicKey}"></script>`;

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3 space-y-2">
      <pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 text-xs">
        <code>{snippet}</code>
      </pre>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy snippet
          </>
        )}
      </Button>
    </div>
  );
}
