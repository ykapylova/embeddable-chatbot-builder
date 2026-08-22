import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readableTextColor } from "./color-contrast";

describe("readableTextColor", () => {
  it("keeps white on the default rose accent", () => {
    assert.equal(readableTextColor("#e85c7b"), "#ffffff");
  });

  it("switches to dark ink on a pale accent, where white would be unreadable", () => {
    assert.equal(readableTextColor("#f2c438"), "#1c1b1a");
    assert.equal(readableTextColor("#ffffff"), "#1c1b1a");
    assert.equal(readableTextColor("#b9c6f2"), "#1c1b1a");
  });

  it("keeps white on dark and mid-tone accents", () => {
    assert.equal(readableTextColor("#4f46e5"), "#ffffff");
    assert.equal(readableTextColor("#1c1b1a"), "#ffffff");
  });

  it("accepts three-digit hex", () => {
    assert.equal(readableTextColor("#fff"), "#1c1b1a");
    assert.equal(readableTextColor("#000"), "#ffffff");
  });

  it("falls back to white for anything it cannot parse", () => {
    assert.equal(readableTextColor("rebeccapurple"), "#ffffff");
    assert.equal(readableTextColor(""), "#ffffff");
  });
});
