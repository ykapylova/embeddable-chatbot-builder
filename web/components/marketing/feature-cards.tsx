import { BarChart3, Globe, Link2, ListChecks, Palette, UserPlus } from "lucide-react";

const features = [
  {
    icon: Link2,
    title: "Source citations",
    description:
      "Every answer links back to the paragraph it came from, so customers can verify it and keep reading.",
  },
  {
    icon: ListChecks,
    title: "Content gaps",
    description:
      "Questions the bot couldn't answer land in one dashboard — a documentation to-do list, ranked by frequency.",
  },
  {
    icon: UserPlus,
    title: "Lead capture",
    description:
      "When the bot doesn't know, it offers to take a name and email instead of losing the visitor.",
  },
  {
    icon: Palette,
    title: "Customisation",
    description: "Match your brand: colours, avatar, and the first message the widget opens with.",
  },
  {
    icon: Globe,
    title: "Domain allowlist",
    description: "The widget only answers on domains you approve — no one can embed your bot elsewhere.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Volume, deflection rate, and the exact questions your customers are asking, by day.",
  },
];

export function FeatureCards() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">
          More than a bot builder
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[var(--muted)]">
          Built for teams whose docs are already the answer — three features generic builders
          don&apos;t have.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6"
            >
              <feature.icon className="h-5 w-5 text-[var(--muted)]" />
              <h3 className="mt-4 font-medium">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-[var(--muted)]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
