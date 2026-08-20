import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse bundles pdfjs-dist, which dynamically requires @napi-rs/canvas
  // to polyfill DOMMatrix in Node. Bundling that require breaks native
  // binary resolution on Vercel (works locally, 500s in production), so both
  // packages must stay external and be traced whole instead.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  // The dynamic require inside pdf-parse's bundled pdfjs-dist isn't visible to
  // Next's static file tracer, so @napi-rs/canvas (and its per-platform
  // native binary) never makes it into the deployed function without this.
  outputFileTracingIncludes: {
    "/api/bots/**": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
    ],
  },
};

export default nextConfig;
