"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MessageCircle, Sparkles, X } from "lucide-react";

import { cn } from "lib/utils";

/* Decoration keeps the gradient; anything with a label on it does not — see
   the note on --brand-2 in globals.css. */
const BRAND_GRADIENT = "linear-gradient(100deg, var(--brand-1), var(--brand-2))";
const CTA_BACKGROUND = "var(--brand-cta)";

/**
 * The public key of the bot this landing page demos, trained on the product's
 * own documentation (PROJECT_SPEC.md §11, block 2). `npm run seed` creates that
 * bot and prints the key to paste here. Unset — a fresh clone before seeding —
 * the panel says so rather than pretending.
 */
const DEMO_BOT_KEY = process.env.NEXT_PUBLIC_DEMO_BOT_KEY?.trim();

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
          {DEMO_BOT_KEY
            ? "👋 Ask me about Docsy — this is the real widget, on our own docs."
            : "👋 This is where the widget sits on your site."}
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
    <div className="animate-chat-pop-in glow-ring flex h-[min(520px,calc(100dvh-8rem))] w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3">
        <span className="text-sm font-medium">Docsy · trained on this page</span>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ background: CTA_BACKGROUND }}
          >
            <Sparkles className="h-3 w-3" />
            Live
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

      {DEMO_BOT_KEY ? (
        // The same iframe a customer's site gets from the snippet, pointed at
        // our own bot: the landing page demos the product by using it.
        <iframe
          src={`/embed/${encodeURIComponent(DEMO_BOT_KEY)}`}
          title="Ask Docsy"
          className="min-h-0 flex-1 border-0"
        />
      ) : (
        <UnconfiguredPanel />
      )}
    </div>
  );
}

/**
 * Shown when no demo bot is configured. It offers the real thing instead of a
 * disabled input box that looks like a broken chat.
 */
function UnconfiguredPanel() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 p-4">
      <p className="rounded-2xl bg-[var(--brand-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
        The demo bot on this deployment has not been set up yet — but yours takes about five
        minutes, and the free plan does not ask for a card.
      </p>
      <Link
        href="/sign-up"
        className="rounded-xl px-3 py-2 text-center text-sm font-medium text-white"
        style={{ background: BRAND_GRADIENT }}
      >
        Build your bot free
      </Link>
    </div>
  );
}
