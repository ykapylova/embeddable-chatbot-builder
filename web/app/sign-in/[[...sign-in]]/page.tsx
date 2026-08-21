import { SignIn } from "@clerk/nextjs";

import { appPaths } from "lib/api-paths";

/**
 * `fallbackRedirectUrl` rather than `forceRedirectUrl`: Clerk uses it only when
 * nothing else says where to go, so the proxy's `?redirect_url=` — the one that
 * carries someone from a deep link they were not signed in for — still wins.
 * Without it Clerk falls back to `/`, which is the marketing landing page.
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={appPaths.dashboard()}
        signUpFallbackRedirectUrl={appPaths.dashboard()}
      />
    </div>
  );
}
