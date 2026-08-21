import { SignUp } from "@clerk/nextjs";

import { appPaths } from "lib/api-paths";

/** Same reasoning as the sign-in page: a fallback, so a deep link still wins. */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl={appPaths.dashboard()}
        signInFallbackRedirectUrl={appPaths.dashboard()}
      />
    </div>
  );
}
