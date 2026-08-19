import Link from "next/link";

import { Button } from "components/ui/button";

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="hero-glow relative overflow-hidden px-6 pt-20 pb-24 text-center sm:pt-28 sm:pb-32">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
          First-line support for SaaS products
        </p>

        <h1 className="mt-4 text-4xl font-semibold text-balance sm:text-6xl">
          Turn your docs into a support agent that never sleeps
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--muted)]">
          Your documentation already answers 80% of your tickets. Nobody reads it. Upload it once
          and a chatbot answers instead — with a link back to the source every time.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          {signedIn ? (
            <Link href="/dashboard">
              <Button size="lg">Go to dashboard</Button>
            </Link>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Link href="/sign-up">
                  <Button size="lg">Build your bot free</Button>
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
