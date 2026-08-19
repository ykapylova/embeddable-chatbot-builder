import Link from "next/link";

import { Button } from "components/ui/button";

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="px-6 py-14">
      <div
        className="relative overflow-hidden rounded-2xl px-8 py-14 text-center text-white shadow-2xl"
        style={{ background: "linear-gradient(120deg, var(--brand-1), var(--brand-2))" }}
      >
        <div
          className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />

        <h2 className="relative text-2xl font-semibold sm:text-3xl">
          Your docs are already written. Let them answer.
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-white/85">
          Upload your documentation and have a working support bot in minutes, on your site and
          inside your app.
        </p>

        <div className="relative mt-7 flex flex-col items-center gap-3">
          <Link href={signedIn ? "/dashboard" : "/sign-up"}>
            <Button size="lg" variant="outline" className="border-white bg-white text-[var(--brand-1)] hover:bg-white/90">
              {signedIn ? "Go to dashboard" : "Build your bot free"}
            </Button>
          </Link>
          {!signedIn ? <p className="text-sm text-white/75">No credit card required</p> : null}
        </div>
      </div>
    </section>
  );
}
