import Link from "next/link";

import { Button } from "components/ui/button";

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-2xl rounded-2xl bg-[var(--accent)] px-8 py-14 text-center text-white">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Your docs are already written. Let them answer.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-white/80">
          Upload your documentation and have a working support bot in minutes, on your site and
          inside your app.
        </p>

        <div className="mt-7 flex flex-col items-center gap-3">
          <Link href={signedIn ? "/dashboard" : "/sign-up"}>
            <Button size="lg" variant="outline" className="border-white bg-white text-[var(--accent)] hover:bg-white/90">
              {signedIn ? "Go to dashboard" : "Build your bot free"}
            </Button>
          </Link>
          {!signedIn ? <p className="text-sm text-white/70">No credit card required</p> : null}
        </div>
      </div>
    </section>
  );
}
