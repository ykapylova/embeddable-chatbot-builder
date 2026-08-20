import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
