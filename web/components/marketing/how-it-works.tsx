import { Code2, Upload, Wand2 } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Upload",
    description:
      "Drop in PDFs, help-center pages, or a sitemap URL. Docsy chunks and indexes it in minutes.",
  },
  {
    icon: Wand2,
    title: "Train",
    description:
      "The bot answers only from what you gave it, with a citation on every claim — no guessing.",
  },
  {
    icon: Code2,
    title: "Embed",
    description: "Paste one script tag on your site, set an allowed domain, and you're live.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">How it works</h2>

        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--panel-soft)] text-sm font-semibold">
                  {index + 1}
                </span>
                <step.icon className="h-5 w-5 text-[var(--muted)]" />
              </div>
              <h3 className="mt-4 text-lg font-medium">{step.title}</h3>
              <p className="mt-1.5 text-sm text-[var(--muted)]">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
