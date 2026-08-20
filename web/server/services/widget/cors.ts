/**
 * `/api/public/*` is called cross-origin, from whatever site embeds the
 * widget. The public key is not a secret (PROJECT_SPEC.md §9), so CORS is
 * not the security boundary here — the `Origin`/`Referer` allowlist check
 * inside each handler is. CORS only decides whether the *browser* lets the
 * widget's own JS read the response; every response, success or 403, must
 * carry these headers or a rejection would surface to the visitor as an
 * opaque network error instead of the honest message the handler wrote.
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
