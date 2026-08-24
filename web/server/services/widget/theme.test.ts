import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { THEME_DEFAULTS } from "lib/bot-defaults";

import { resolveBubblePosition, resolveWidgetTheme } from "./theme";

describe("resolveWidgetTheme", () => {
  it("falls back to the shared defaults for an unconfigured bot", () => {
    const theme = resolveWidgetTheme({}, true);

    assert.equal(theme.accentColor, THEME_DEFAULTS.accentColor);
    assert.equal(theme.placeholder, THEME_DEFAULTS.placeholder);
    assert.equal(theme.avatarUrl, null);
  });

  it("survives a theme column that is not an object", () => {
    assert.equal(resolveWidgetTheme(null, true).accentColor, THEME_DEFAULTS.accentColor);
    assert.equal(resolveWidgetTheme("#000", true).accentColor, THEME_DEFAULTS.accentColor);
  });

  it("keeps the bot's own values", () => {
    const theme = resolveWidgetTheme(
      { accentColor: "#111111", avatarUrl: "https://cdn.test/a.png", placeholder: "Ask us" },
      true,
    );

    assert.equal(theme.accentColor, "#111111");
    assert.equal(theme.avatarUrl, "https://cdn.test/a.png");
    assert.equal(theme.placeholder, "Ask us");
  });

  it("carries brandingEnabled through unchanged", () => {
    // ChatSurface hides the badge only on an explicit `false`, so anything that
    // loses the flag here silently re-brands a paying customer's widget.
    assert.equal(resolveWidgetTheme({}, false).brandingEnabled, false);
    assert.equal(resolveWidgetTheme({}, true).brandingEnabled, true);
  });
});

describe("resolveBubblePosition", () => {
  it("keeps the bot's configured corner", () => {
    assert.equal(resolveBubblePosition({ position: "bottom-left" }), "bottom-left");
    assert.equal(resolveBubblePosition({ position: "bottom-right" }), "bottom-right");
  });

  it("falls back to the shared default for an unconfigured or broken theme", () => {
    assert.equal(resolveBubblePosition({}), THEME_DEFAULTS.position);
    assert.equal(resolveBubblePosition(null), THEME_DEFAULTS.position);
    assert.equal(resolveBubblePosition("bottom-left"), THEME_DEFAULTS.position);
  });

  it("rejects a corner it does not know", () => {
    // widget.js sets `left`/`right` straight from this value, so anything that
    // is not one of the two corners must never reach the host page.
    assert.equal(resolveBubblePosition({ position: "top-left" }), THEME_DEFAULTS.position);
  });
});
