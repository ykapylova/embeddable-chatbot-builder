import { MessageCircle } from "lucide-react";

/**
 * The widget itself is mounted by `DemoWidget`, fixed to the corner of the whole
 * page. This section is what points at it — without it a visitor scrolls past
 * the strongest argument the landing page has.
 */
const DEMO_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_DEMO_BOT_KEY?.trim());

export function LiveDemo() {
  return (
    <section id="live-demo" className="px-6 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold sm:text-3xl">See it before you build it</h2>
        <p className="mx-auto mt-3 max-w-lg text-[var(--muted)]">
          Look in the bottom-right corner{" "}
          <MessageCircle className="inline h-4 w-4 align-[-2px] text-[var(--brand-1)]" /> — that&apos;s
          the same widget that will sit on your own site, and it follows you around this page the
          way it&apos;ll follow visitors around yours.
        </p>
        <p className="mx-auto mt-2 max-w-lg text-xs text-[var(--muted)]">
          {DEMO_CONFIGURED
            ? "It is trained on this product's own documentation, so ask it what a credit is, or what happens when you run out — the answers come with a link to the page they came from."
            : "This deployment has no demo bot configured yet, so the panel offers a sign-up instead of a faked conversation."}
        </p>
      </div>
    </section>
  );
}
