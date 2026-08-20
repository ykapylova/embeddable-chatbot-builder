import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isHostAllowed, resolveRequestHost } from "./origin";

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
