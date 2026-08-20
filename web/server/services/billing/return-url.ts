import { env } from "server/env";

/**
 * `returnUrl` comes from the client, so it is allowlisted against our own
 * origin before it ever reaches Stripe — an open-redirect otherwise
 * (PROJECT_SPEC.md §10.8 #14 / the "billing security" note in §10.8).
 * A relative path is resolved against our origin; anything else falls back
 * to `fallbackPath` rather than erroring.
 */
export function safeReturnUrl(candidate: string | undefined, fallbackPath: string): string {
  const appOrigin = new URL(env.appUrl).origin;
  if (!candidate) return `${appOrigin}${fallbackPath}`;

  try {
    const parsed = new URL(candidate, appOrigin);
    return parsed.origin === appOrigin ? parsed.toString() : `${appOrigin}${fallbackPath}`;
  } catch {
    return `${appOrigin}${fallbackPath}`;
  }
}
