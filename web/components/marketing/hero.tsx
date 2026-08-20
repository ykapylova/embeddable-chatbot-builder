import Link from "next/link";

import { Button } from "components/ui/button";

const BRAND_GRADIENT = "linear-gradient(100deg, var(--brand-1), var(--brand-2))";

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="hero-glow relative overflow-hidden px-6 pt-16 pb-16 text-center sm:pt-20 sm:pb-20">
      <div className="mx-auto max-w-3xl">
        <span className="animate-chat-fade-up inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-4 py-1.5 text-sm font-medium text-[var(--brand-1)]">
          <span className="animate-chat-pulse-soft h-1.5 w-1.5 rounded-full bg-[var(--brand-1)]" />
          First-line support for SaaS products
        </span>

        <h1
          className="animate-chat-fade-up mt-5 text-4xl font-bold tracking-tight text-balance sm:text-6xl"
          style={{ animationDelay: "80ms" }}
        >
          Turn your docs into a <span className="brand-text">support agent</span> that never
          sleeps
        </h1>

        <p
          className="animate-chat-fade-up mx-auto mt-6 max-w-xl text-lg text-[var(--muted)]"
          style={{ animationDelay: "150ms" }}
        >
          Your documentation already answers 80% of your tickets. Nobody reads it. Upload it once
          and a chatbot answers instead — with a link back to the source every time.
        </p>

        <div
          className="animate-chat-fade-up mt-8 flex flex-col items-center gap-3"
          style={{ animationDelay: "220ms" }}
        >
          {signedIn ? (
            <Link href="/dashboard">
              <Button size="lg" className="border-0 shadow-lg" style={{ background: BRAND_GRADIENT }}>
                Go to dashboard
              </Button>
            </Link>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="glow-ring border-0 shadow-lg hover:opacity-95"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    Build your bot free
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline">
                    See pricing
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-[var(--muted)]">No credit card required</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
