import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The client router treats a dynamic segment as stale the moment it is
    // rendered (`dynamic` defaults to 0), so every console tab click refetches
    // the RSC payload of a tab that was on screen seconds ago. Nothing under
    // `(app)` renders server data — the pages are shells and every value comes
    // from React Query on the client — so a reusable window costs no freshness
    // and makes moving back and forth between tabs instant. Thirty seconds
    // matches the query client's own `staleTime`, which keeps the two caches
    // expiring together instead of one masking the other.
    staleTimes: { dynamic: 30 },
  },
  // pdf-parse bundles pdfjs-dist, which dynamically requires @napi-rs/canvas
  // to polyfill DOMMatrix in Node. Bundling that require breaks native
  // binary resolution on Vercel (works locally, 500s in production), so both
  // packages must stay external and be traced whole instead.
  // pdfjs-dist (pulled in by pdf-parse) loads its own worker script via a
  // dynamic import at runtime, not a real Worker thread — it must stay
  // external too, or the worker file it looks for at a fixed on-disk path
  // no longer exists once bundled.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "pdfjs-dist"],
  // Both of the below are loaded through dynamic require()/import() calls
  // that Next's static file tracer can't see, so neither @napi-rs/canvas's
  // native binary nor pdfjs-dist's worker script make it into the deployed
  // function without an explicit include.
  outputFileTracingIncludes: {
    "/api/bots/**": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
      "./node_modules/pdfjs-dist/legacy/build/*.mjs",
    ],
  },
};

export default nextConfig;
