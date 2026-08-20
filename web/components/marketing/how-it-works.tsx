import { Code2, Upload, Wand2 } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Upload",
    description:
      "Drop in PDFs, help-center pages, or a sitemap URL. Docsy chunks and indexes it in minutes.",
    chipBg: "var(--chip-violet-bg)",
    chipFg: "var(--chip-violet-fg)",
  },
  {
    icon: Wand2,
    title: "Train",
    description:
      "The bot answers only from what you gave it, with a citation on every claim — no guessing.",
    chipBg: "var(--chip-teal-bg)",
    chipFg: "var(--chip-teal-fg)",
  },
  {
    icon: Code2,
    title: "Embed",
    description: "Paste one script tag on your site, set an allowed domain, and you're live.",
    chipBg: "var(--chip-amber-bg)",
    chipFg: "var(--chip-amber-fg)",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-14">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">How it works</h2>

        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_45px_-15px_var(--brand-ring)]"
            >
              <span
                className="absolute top-4 right-5 text-4xl font-bold opacity-[0.08]"
                aria-hidden
              >
                {index + 1}
              </span>
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ background: step.chipBg, color: step.chipFg }}
              >
                <step.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-[var(--muted)]">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
