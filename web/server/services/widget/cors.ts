/**
 * `/api/public/*` is called from inside the widget's iframe, which this app
 * serves, so the normal case is same-origin and needs none of this. CORS is
 * here for everything else that reaches these routes: the public key is not a
 * secret (PROJECT_SPEC.md §9), so CORS is not the security boundary — the
 * allowlist check on the iframe navigation is (`server/services/widget/origin.ts`).
 * CORS only decides whether the *browser* lets the caller's JS read the
 * response; every response, success or 403, must carry these headers or a
 * rejection would surface as an opaque network error instead of the honest
 * message the handler wrote.
 */
export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function corsPreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}
