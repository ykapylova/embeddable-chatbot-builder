import { MessageCircle } from "lucide-react";

export function LiveDemoPlaceholder() {
  return (
    <section id="live-demo" className="px-6 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold sm:text-3xl">See it before you build it</h2>
        <p className="mx-auto mt-3 max-w-lg text-[var(--muted)]">
          Look in the bottom-right corner{" "}
          <MessageCircle className="inline h-4 w-4 align-[-2px] text-[var(--brand-1)]" /> — that&apos;s
          the widget shell that will sit on your own site, trained on your docs. It follows you
          around this page the same way it&apos;ll follow visitors around yours.
        </p>
        <p className="mx-auto mt-2 max-w-lg text-xs text-[var(--muted)]">
          It&apos;s a preview of the shell, not a working chat yet — an honest &quot;coming
          soon&quot; beats a faked conversation.
        </p>
      </div>
    </section>
  );
}
