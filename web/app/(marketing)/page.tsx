import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { Button } from "components/ui/button";

// The real landing page is phase 9. This is the minimum needed to reach the app.
export default async function MarketingPage() {
  const { userId } = await auth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
        Embeddable Chatbot Builder
      </p>
      <h1 className="text-4xl font-semibold text-balance sm:text-5xl">
        Turn your docs into a support agent that never sleeps
      </h1>
      <p className="max-w-xl text-lg text-[var(--muted)]">
        Upload your documentation, get a chatbot that answers with citations — in your app and
        as a widget on your site.
      </p>

      <div className="flex items-center gap-3">
        {userId ? (
          <Link href="/dashboard">
            <Button size="lg">Go to dashboard</Button>
          </Link>
        ) : (
          <>
            <Link href="/sign-up">
              <Button size="lg">Build your bot free</Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline">
                Sign in
              </Button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
