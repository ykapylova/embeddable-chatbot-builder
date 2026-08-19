import { Sparkles } from "lucide-react";

export function LiveDemoPlaceholder() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold sm:text-3xl">See it before you build it</h2>
        <p className="mx-auto mt-3 max-w-lg text-[var(--muted)]">
          This is the widget shell that will sit right here, trained on Docsy&apos;s own docs, so
          you can ask it a question before you sign up.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3">
          <span className="text-sm font-medium">Docsy · trained on this page</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-white">
            <Sparkles className="h-3 w-3" />
            Preview
          </span>
        </div>

        <div className="space-y-3 px-4 py-5">
          <div className="max-w-[85%] rounded-lg bg-[var(--panel-soft)] px-3 py-2 text-sm">
            Hi — ask me anything about Docsy&apos;s setup, pricing, or the widget.
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
          <input
            disabled
            placeholder="This box goes live once the widget ships"
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--muted)] placeholder:text-[var(--muted)]"
          />
          <button
            disabled
            className="rounded-md bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--muted)]"
          >
            Send
          </button>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-md text-center text-xs text-[var(--muted)]">
        Coming with the embeddable widget — not wired up yet, so we&apos;re not faking it.
      </p>
    </section>
  );
}
