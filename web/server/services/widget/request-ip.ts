/**
 * Route handlers get a plain `Request`, not `NextRequest` — there is no
 * `.ip`. Vercel (and any proxy in front of Node) sets `x-forwarded-for`;
 * `x-real-ip` covers the rest. A request with neither still rate-limits by
 * visitor and bot, so this is defense in depth, not the only guard.
 */
export function resolveRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}
