/**
 * Tenants choose their own accent colour, so anything painted on top of it —
 * the user's chat bubble, the send button, the lead-capture CTA — cannot
 * hard-code white text: a pale amber accent makes white unreadable. Relative
 * luminance per WCAG 2.1 §1.4.3, then whichever of the two product inks wins.
 */

const LIGHT_INK = "#ffffff";
const DARK_INK = "#1c1b1a";

function parseHex(color: string): [number, number, number] | null {
  const value = color.trim().replace(/^#/, "");
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: number, b: number): number {
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

/*
 * White stays the default so a tenant on the brand rose keeps the pairing the
 * design system ships (`--accent-foreground`), even though dark ink would score
 * marginally higher there. It only gives way once white drops under the 3:1
 * floor WCAG sets for large text and UI components — the pale accents (amber,
 * mint, plain white) where white text simply disappears.
 */
const WHITE_MIN_RATIO = 3;

/** The product ink that reads on `background`. Unparseable input keeps white. */
export function readableTextColor(background: string): string {
  const rgb = parseHex(background);
  if (!rgb) return LIGHT_INK;

  const backgroundLuminance = relativeLuminance(rgb);
  const onWhite = contrastRatio(backgroundLuminance, relativeLuminance(parseHex(LIGHT_INK)!));
  const onDark = contrastRatio(backgroundLuminance, relativeLuminance(parseHex(DARK_INK)!));
  return onWhite >= WHITE_MIN_RATIO || onWhite >= onDark ? LIGHT_INK : DARK_INK;
}
