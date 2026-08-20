import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeReturnUrl } from "./return-url";

describe("safeReturnUrl", () => {
  it("resolves a relative path against the app origin", () => {
    assert.equal(safeReturnUrl("/billing?foo=1", "/billing"), "http://localhost:3000/billing?foo=1");
  });

  it("keeps a same-origin absolute URL", () => {
    assert.equal(safeReturnUrl("http://localhost:3000/dashboard", "/billing"), "http://localhost:3000/dashboard");
  });

  it("falls back to the default path for a cross-origin URL — open-redirect protection", () => {
    assert.equal(safeReturnUrl("https://evil.example.com/steal", "/billing"), "http://localhost:3000/billing");
  });

  it("falls back to the default path when nothing is given", () => {
    assert.equal(safeReturnUrl(undefined, "/billing"), "http://localhost:3000/billing");
  });
});
