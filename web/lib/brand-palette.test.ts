import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * Reads the tokens out of `globals.css` rather than restating them, so the
 * stylesheet stays the one place a brand colour is written down. The gradient
 * that prompted this ran rose to amber with `text-white` on top of it: white on
 * `#f2c438` measures about 1.5:1, which means the right-hand half of every
 * primary button on the landing page was unreadable against its own background.
 */
const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf-8");

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  assert.ok(match, `--${name} is not defined in globals.css`);
  return match[1];
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const WHITE = "#ffffff";
const AA_NORMAL = 4.5;
const AA_LARGE = 3;

test("white copy on the CTA colour clears AA for normal text", () => {
  assert.ok(
    contrast(WHITE, token("brand-cta")) >= AA_NORMAL,
    `--brand-cta is ${contrast(WHITE, token("brand-cta")).toFixed(2)}:1 against white`,
  );
});

test("both ends of the CTA panel gradient clear AA", () => {
  // The panel is one surface with body copy across all of it, so it is the
  // *worst* stop that has to pass, not the average.
  for (const name of ["brand-cta", "brand-cta-deep"]) {
    assert.ok(
      contrast(WHITE, token(name)) >= AA_NORMAL,
      `--${name} is ${contrast(WHITE, token(name)).toFixed(2)}:1 against white`,
    );
  }
});

test("gradient headline text stays readable on the cream background", () => {
  // `.brand-text` paints the headline with the gradient, so here the
  // requirement runs the other way: both stops must be dark enough against
  // cream. Headlines are large text, so AA is 3:1.
  const background = token("background");
  for (const name of ["brand-1", "brand-ink"]) {
    assert.ok(
      contrast(background, token(name)) >= AA_LARGE,
      `--${name} is ${contrast(background, token(name)).toFixed(2)}:1 against the page`,
    );
  }
});

test("the decorative gradient is still the decorative gradient", () => {
  // Not a bug to fix — a fact to keep visible. `--brand-2` cannot carry white
  // text, which is exactly why the text-safe tokens exist alongside it.
  assert.ok(contrast(WHITE, token("brand-2")) < AA_LARGE);
});
