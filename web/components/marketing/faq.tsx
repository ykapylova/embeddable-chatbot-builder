import { Plus } from "lucide-react";

const items = [
  {
    question: "What's a credit?",
    answer:
      "One credit is one answer from the fast model, GPT-4o-mini. An answer from GPT-4o, the advanced model, costs 5 credits — it's a larger model and costs more to run.",
  },
  {
    question: "What happens when I hit my limit?",
    answer:
      "On Free, the bot switches to an honest placeholder — \"I can't answer right now, leave your contact\" — and keeps collecting leads instead of going offline. Pro and Business get a 10% grace buffer first, then the same fallback plus an email to you.",
  },
  {
    question: "What happens to our data?",
    answer:
      "Every question is answered only from your own bot's documents — nothing crosses between bots. Secrets and API keys stay on the server; nothing sensitive ever reaches the browser or the widget.",
  },
  {
    question: "Does it ever make things up?",
    answer:
      "No. When the match to your docs is too weak, the bot says it couldn't find the answer instead of guessing, and every real answer links back to the source paragraph it came from.",
  },
  {
    question: "What languages does it support?",
    answer:
      "Whatever language the visitor asks in — the bot answers in the language of the question, not necessarily the language your docs are written in.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, from Billing, no retention call. You keep access until the end of the paid period, and exporting or deleting your own data is never gated behind a subscription.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">Frequently asked</h2>

        <div className="mt-8 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--panel)]">
          {items.map((item) => (
            <details key={item.question} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {item.question}
                <Plus className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-open:rotate-45" />
              </summary>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
