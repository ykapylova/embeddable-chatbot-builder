import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Next 16 renamed this file convention from `middleware` to `proxy`; the
 * default export and `config.matcher` are unchanged, and Clerk's helper keeps
 * its own name because it is a request handler, not a file convention.
 *
 * Public surface of the product:
 * - marketing (`/`) is readable signed out;
 * - `/api/public/*` serves the widget, where auth is the bot public key plus the
 *   allowlist check on the iframe navigation, not a Clerk session;
 * - `/embed/*` is excluded from the matcher below rather than merely listed as
 *   public: a dev Clerk instance answers a cookie-less document request with a
 *   handshake redirect, and inside a cross-site iframe the cookie it sets is
 *   never sent back, so the widget spun in a redirect loop on any site that is
 *   not same-site with the app. The route has no session to read anyway;
 * - `/api/billing/webhook` comes from Stripe and verifies its own signature;
 * - `/api/billing/grace-sweep` comes from Vercel Cron and verifies `CRON_SECRET`,
 *   not a Clerk session — it has no session to protect with;
 * - `/api/plans` is the public pricing catalogue used by the landing page.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
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
    "/((?!_next|embed/|widget.js|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
