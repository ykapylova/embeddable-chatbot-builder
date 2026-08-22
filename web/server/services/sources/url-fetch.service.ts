import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { SOURCE_URL_FETCH_MAX_BYTES, SOURCE_URL_FETCH_TIMEOUT_MS } from "server/limits";

import { SourceContentError } from "./errors";

const MAX_REDIRECTS = 3;
const BLOCKED_URL_MESSAGE = "This URL points to a private or internal address, which is not allowed.";

function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const octets = ip.split(".").map(Number);
    const [a, b] = octets;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fe80:")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    if (normalized.startsWith("::ffff:")) {
      // IPv4-mapped IPv6 — validate the embedded address instead.
      return isPrivateOrReservedIp(normalized.slice("::ffff:".length));
    }
    return false;
  }
  return true; // not a resolvable IP literal at all — treat as untrusted
}

/** Rejects requests aimed at loopback/private/link-local addresses so a
 * "URL" source can't be used to probe the server's own network. Checked
 * against the resolved IP, not just the hostname string, and re-checked on
 * every redirect hop since a redirect could otherwise point somewhere the
 * original URL didn't. */
async function assertPubliclyRoutable(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SourceContentError("Only http and https URLs are supported.", "UNSUPPORTED_CONTENT");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (hostname === "localhost") {
    throw new SourceContentError(BLOCKED_URL_MESSAGE, "UNSUPPORTED_CONTENT");
  }

  let address: string;
  try {
    address = isIP(hostname) ? hostname : (await lookup(hostname)).address;
  } catch {
    throw new SourceContentError("Could not resolve this URL's address.", "UNKNOWN");
  }

  if (isPrivateOrReservedIp(address)) {
    throw new SourceContentError(BLOCKED_URL_MESSAGE, "UNSUPPORTED_CONTENT");
  }
}

/** Fetches a page's HTML for indexing. Times out, caps the response size,
 * rejects non-HTML content and internal addresses (including on redirect
 * hops) — a source add should never hang on, or reach into, somewhere it
 * shouldn't. */
export async function fetchUrlHtml(rawUrl: string): Promise<string> {
  let currentUrl = new URL(rawUrl);

  let response: Response | undefined;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPubliclyRoutable(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOURCE_URL_FETCH_TIMEOUT_MS);
    try {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ChatbotBuilderIndexer/1.0)",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new SourceContentError("This URL took too long to respond.", "TIMEOUT");
      }
      throw new SourceContentError("Could not reach this URL.", "UNKNOWN");
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new SourceContentError("This URL redirected without a destination.", "UNKNOWN");
      }
      currentUrl = new URL(location, currentUrl);
      response = undefined;
      continue;
    }

    break;
  }

  if (!response) {
    throw new SourceContentError("This URL redirected too many times.", "UNKNOWN");
  }
  if (!response.ok) {
    throw new SourceContentError(`This URL returned an error (status ${response.status}).`, "UNKNOWN");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    throw new SourceContentError("This URL did not return a readable HTML page.", "UNSUPPORTED_CONTENT");
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > SOURCE_URL_FETCH_MAX_BYTES) {
    throw new SourceContentError("This page is too large to index.", "LIMIT_CHARS");
  }

  return Buffer.from(buffer).toString("utf-8");
}
