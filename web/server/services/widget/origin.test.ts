import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkEmbedAccess, isHostAllowed, isSelfOriginated, resolveRequestHost } from "./origin";

describe("isHostAllowed", () => {
  it("allows an exact match", () => {
    assert.equal(isHostAllowed("customer.com", ["customer.com"]), true);
  });

  it("treats www. as the same site", () => {
    assert.equal(isHostAllowed("www.customer.com", ["customer.com"]), true);
    assert.equal(isHostAllowed("customer.com", ["www.customer.com"]), true);
  });

  it("rejects a domain absent from the allowlist", () => {
    assert.equal(isHostAllowed("evil.com", ["customer.com"]), false);
  });

  it("rejects everything when the allowlist is empty", () => {
    assert.equal(isHostAllowed("customer.com", []), false);
  });

  it("rejects a missing host", () => {
    assert.equal(isHostAllowed(null, ["customer.com"]), false);
  });
});

describe("resolveRequestHost", () => {
  it("prefers Origin over Referer", () => {
    const request = new Request("https://app.example.com/api/public/chat", {
      method: "POST",
      headers: { origin: "https://customer.com", referer: "https://other.com/page" },
    });
    assert.equal(resolveRequestHost(request), "customer.com");
  });

  it("falls back to Referer when Origin is absent", () => {
    const request = new Request("https://app.example.com/api/public/chat", {
      method: "POST",
      headers: { referer: "https://customer.com/page" },
    });
    assert.equal(resolveRequestHost(request), "customer.com");
  });

  it("returns null when neither header is present or parseable", () => {
    const request = new Request("https://app.example.com/api/public/chat", { method: "POST" });
    assert.equal(resolveRequestHost(request), null);
  });
});

describe("isSelfOriginated", () => {
  const appUrl = "https://app.example.com";

  it("accepts a call made from inside the app's own iframe", () => {
    const request = new Request("https://app.example.com/api/public/chat", {
      method: "POST",
      headers: { origin: "https://app.example.com", referer: "https://app.example.com/embed/pk_1" },
    });
    assert.equal(isSelfOriginated(request, appUrl), true);
  });

  it("ignores the port, which differs between dev harness pages", () => {
    const request = new Request("http://localhost:3000/api/public/chat", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    assert.equal(isSelfOriginated(request, "http://localhost:4000"), true);
  });

  it("rejects a call made straight from a customer's page", () => {
    const request = new Request("https://app.example.com/api/public/chat", {
      method: "POST",
      headers: { origin: "https://customer.com" },
    });
    assert.equal(isSelfOriginated(request, appUrl), false);
  });

  it("rejects a call with no origin and no referer at all", () => {
    const request = new Request("https://app.example.com/api/public/chat", { method: "POST" });
    assert.equal(isSelfOriginated(request, appUrl), false);
  });
});

describe("checkEmbedAccess", () => {
  const framed = { secFetchDest: "iframe" as string | null, allowedDomains: ["customer.com"] };

  it("allows an iframe on an allowlisted site", () => {
    const access = checkEmbedAccess({ ...framed, referer: "https://customer.com/pricing" });
    assert.deepEqual(access, { allowed: true, host: "customer.com" });
  });

  it("refuses an iframe on a site that is not on the list", () => {
    const access = checkEmbedAccess({ ...framed, referer: "https://evil.com/copy" });
    assert.deepEqual(access, { allowed: false, reason: "DOMAIN_NOT_ALLOWED", host: "evil.com" });
  });

  // The bug this whole check exists for: the panel used to be gated on the
  // app's own hostname, so every owner had to allowlist us instead of their site.
  it("does not treat the app's own hostname as an allowlisted embedder", () => {
    const access = checkEmbedAccess({
      secFetchDest: "iframe",
      allowedDomains: ["customer.com"],
      referer: "https://app.example.com/widget-harness.html",
    });
    assert.equal(access.allowed, false);
  });

  it("refuses a top-level visit to the embed URL", () => {
    const access = checkEmbedAccess({
      secFetchDest: "document",
      allowedDomains: ["customer.com"],
      referer: "https://customer.com/pricing",
    });
    assert.deepEqual(access, { allowed: false, reason: "NOT_EMBEDDED", host: null });
  });

  it("refuses an iframe whose host page withholds its Referer", () => {
    const access = checkEmbedAccess({ ...framed, referer: null });
    assert.deepEqual(access, { allowed: false, reason: "NOT_EMBEDDED", host: null });
  });

  it("still checks the Referer on browsers that send no Sec-Fetch-Dest", () => {
    const allowed = checkEmbedAccess({
      secFetchDest: null,
      allowedDomains: ["customer.com"],
      referer: "https://customer.com/pricing",
    });
    assert.equal(allowed.allowed, true);
    const refused = checkEmbedAccess({
      secFetchDest: null,
      allowedDomains: ["customer.com"],
      referer: "https://evil.com/copy",
    });
    assert.equal(refused.allowed, false);
  });

  it("refuses everything for a bot with an empty allowlist", () => {
    const access = checkEmbedAccess({
      secFetchDest: "iframe",
      allowedDomains: [],
      referer: "https://customer.com/pricing",
    });
    assert.deepEqual(access, { allowed: false, reason: "DOMAIN_NOT_ALLOWED", host: "customer.com" });
  });
});
