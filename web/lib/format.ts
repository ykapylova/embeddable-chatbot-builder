/**
 * Usage numbers are shown in full, never rounded to "1k": the reader is being
 * asked to judge how close they are to a plan limit, and "1k of 1k" hides both
 * the headroom and the overage.
 */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
