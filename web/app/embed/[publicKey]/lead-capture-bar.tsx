"use client";

import { useState } from "react";
import { X } from "lucide-react";

type LeadState = "idle" | "submitting" | "sent" | "error";

export function LeadCaptureBar({
  publicKey,
  conversationId,
  question,
  fallbackMessage,
  accentColor,
  onDismiss,
}: {
  publicKey: string;
  conversationId: string | undefined;
  question: string;
  fallbackMessage: string;
  accentColor: string;
  onDismiss: () => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LeadState>("idle");

  async function submit() {
    if (!email.trim()) return;
    setState("submitting");
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, conversationId, email: email.trim(), question }),
      });
      if (!res.ok) throw new Error("failed");
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 text-xs text-[var(--muted)] shadow-xl">
        Thanks — we&apos;ll follow up by email.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 text-xs shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-[var(--foreground)]">{fallbackMessage}</p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form
        className="flex items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-xs outline-none focus:border-[#c9d0dd]"
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: accentColor }}
        >
          {state === "submitting" ? "Sending…" : "Notify me"}
        </button>
      </form>

      {state === "error" ? <p className="mt-1 text-red-600">Could not send — try again.</p> : null}
    </div>
  );
}
