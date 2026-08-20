/**
 * The public key is not a secret (PROJECT_SPEC.md §9) — the real protection is
 * this check. Every request from the widget must come from a page whose
 * `Origin` (or, failing that, `Referer`) hostname is on the bot's allowlist.
 */

function hostFromHeaderValue(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** `Origin` is sent on every fetch/XHR; `Referer` is the fallback for older or stripped requests. */
export function resolveRequestHost(request: Request): string | null {
  return hostFromHeaderValue(request.headers.get("origin")) ?? hostFromHeaderValue(request.headers.get("referer"));
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "");
}

/**
 * A bot with no configured domains allows nothing — "domain absent from
 * allowed_domains" is also true of an empty list, and an unconfigured widget
 * embarrassing a customer on the wrong site is the worse failure.
 */
export function isHostAllowed(host: string | null, allowedDomains: string[]): boolean {
  if (!host) return false;
  const normalizedHost = normalizeDomain(host);
  return allowedDomains.some((domain) => normalizeDomain(domain) === normalizedHost);
}
