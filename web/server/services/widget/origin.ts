/**
 * The public key is not a secret (PROJECT_SPEC.md §9), so the allowlist is the
 * real protection — but only where it is checked against a header the
 * embedding page cannot choose for itself.
 *
 * The widget's chat/lead/feedback calls are `fetch`es made *inside* our own
 * iframe, so their `Origin` is this app and never the site the visitor is on:
 * checking those against a bot's allowlist compares the app to itself. The one
 * request the embedding site is a party to is the iframe's own document
 * navigation, where the browser sets `Referer` to the embedding page and
 * `Sec-Fetch-Dest: iframe`, and host-page JS can forge neither. So the
 * allowlist is enforced there — `checkEmbedAccess`, called from
 * `app/embed/[publicKey]/page.tsx` — and the public API routes only verify
 * that the caller is that iframe.
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
export function isHostAllowed(host: string | null, allowedDomains: readonly string[]): boolean {
  if (!host) return false;
  const normalizedHost = normalizeDomain(host);
  return allowedDomains.some((domain) => normalizeDomain(domain) === normalizedHost);
}

/**
 * True when the request was made from a page this app served — in practice,
 * from the widget's own iframe. A guard rather than a boundary: a client that
 * is not a browser writes its own headers, which is what the per-visitor, per-IP
 * and per-bot rate limits exist for.
 */
export function isSelfOriginated(request: Request, appUrl: string): boolean {
  const appHost = hostFromHeaderValue(appUrl);
  if (!appHost) return false;
  return isHostAllowed(resolveRequestHost(request), [appHost]);
}

export type EmbedAccess =
  | { allowed: true; host: string }
  | { allowed: false; reason: "NOT_EMBEDDED" | "DOMAIN_NOT_ALLOWED"; host: string | null };

/**
 * Decides whether the panel may render for the page that framed it.
 *
 * `Sec-Fetch-Dest` is absent on browsers that predate it; those still reach the
 * `Referer` check below, which is the part that carries the answer.
 */
export function checkEmbedAccess(input: {
  referer: string | null;
  secFetchDest: string | null;
  allowedDomains: readonly string[];
}): EmbedAccess {
  const dest = input.secFetchDest?.toLowerCase() ?? null;
  if (dest !== null && dest !== "iframe" && dest !== "frame") {
    return { allowed: false, reason: "NOT_EMBEDDED", host: null };
  }

  const host = hostFromHeaderValue(input.referer);
  // A host page that sends `Referrer-Policy: no-referrer` withholds the only
  // signal worth trusting. Refusing is the sole safe reading of that: falling
  // back to anything the page itself supplies would make the allowlist theatre.
  if (!host) return { allowed: false, reason: "NOT_EMBEDDED", host: null };

  if (!isHostAllowed(host, input.allowedDomains)) {
    return { allowed: false, reason: "DOMAIN_NOT_ALLOWED", host };
  }
  return { allowed: true, host };
}
