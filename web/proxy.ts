import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Next 16 renamed this file convention from `middleware` to `proxy`; the
 * default export and `config.matcher` are unchanged, and Clerk's helper keeps
 * its own name because it is a request handler, not a file convention.
 *
 * Public surface of the product:
 * - marketing (`/`, `/pricing`) is readable signed out;
 * - `/embed/*` and `/api/public/*` serve the widget on customer sites, where auth
 *   is the bot public key plus an Origin check, not a Clerk session;
 * - `/api/billing/webhook` comes from Stripe and verifies its own signature;
 * - `/api/billing/grace-sweep` comes from Vercel Cron and verifies `CRON_SECRET`,
 *   not a Clerk session — it has no session to protect with;
 * - `/api/plans` is the public pricing catalogue used by the landing page.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/embed(.*)",
  "/api/public(.*)",
  "/api/plans",
  "/api/billing/webhook",
  "/api/billing/grace-sweep",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    return;
  }

  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|widget.js|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
