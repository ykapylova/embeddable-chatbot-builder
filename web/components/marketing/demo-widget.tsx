"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Sparkles, X } from "lucide-react";

import { cn } from "lib/utils";

const BRAND_GRADIENT = "linear-gradient(100deg, var(--brand-1), var(--brand-2))";

export function DemoWidget() {
  const [open, setOpen] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [breathe, setBreathe] = useState(false);

  useEffect(() => {
    const target = document.getElementById("live-demo");
    if (!target) return;

    let leaveTimer: ReturnType<typeof setTimeout> | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (leaveTimer) clearTimeout(leaveTimer);
          setBreathe(true);
          setShowNudge(true);
        } else {
          // Let the current pulse settle back to rest instead of cutting it off mid-cycle.
          leaveTimer = setTimeout(() => setBreathe(false), 300);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(target);
    return () => {
      if (leaveTimer) clearTimeout(leaveTimer);
      observer.disconnect();
    };
  }, []);

  const nudgeVisible = showNudge && !nudgeDismissed && !open;

  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open ? <ChatPanel onClose={() => setOpen(false)} /> : null}

      {nudgeVisible ? (
        <div className="animate-chat-pop-in relative max-w-[220px] rounded-xl rounded-br-sm border border-[var(--border)] bg-[var(--panel)] p-3 pr-7 text-sm shadow-xl">
          <button
            onClick={() => setNudgeDismissed(true)}
            aria-label="Dismiss"
            className="absolute top-1.5 right-1.5 rounded-full p-1 text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          👋 Ask me about Docsy — this is a live preview of the widget.
        </div>
      ) : null}

      {!open ? (
        <button
          onClick={() => {
            setOpen(true);
            setShowNudge(false);
          }}
          aria-label="Open chat demo"
          className={cn(
            "glow-ring relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-all duration-500 ease-out hover:scale-105",
            breathe && "animate-chat-bubble-breathe",
          )}
          style={{ background: BRAND_GRADIENT }}
        >
          <MessageCircle className="h-6 w-6" />
          {nudgeVisible ? (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-xs font-semibold text-[var(--brand-1)] ring-2 ring-[var(--brand-1)]">
              1
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="animate-chat-pop-in glow-ring flex w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3">
        <span className="text-sm font-medium">Docsy · trained on this page</span>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ background: BRAND_GRADIENT }}
          >
            <Sparkles className="h-3 w-3" />
            Preview
          </span>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="rounded-full p-1 text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 px-4 py-5">
        <div className="max-w-[85%] rounded-2xl bg-[var(--brand-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
          Hi — ask me anything about Docsy&apos;s setup, pricing, or the widget.
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
        <input
          disabled
          placeholder="This box goes live once the widget ships"
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-xs text-[var(--muted)] placeholder:text-[var(--muted)]"
        />
        <button
          disabled
          className="rounded-xl bg-[var(--panel-soft)] px-3 py-2 text-xs text-[var(--muted)]"
        >
          Send
        </button>
      </div>
      <p className="border-t border-[var(--border)] px-4 py-2 text-center text-xs text-[var(--muted)]">
        Coming with the embeddable widget — not wired up yet, so we&apos;re not faking it.
      </p>
    </div>
  );
}
