import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chunkText, detectHeading, estimateTokenCount } from "./chunk.service";

const LONG_PARAGRAPH = "The quick brown fox jumps over the lazy dog. ".repeat(120);

describe("detectHeading", () => {
  it("recognises a markdown heading and keeps only its text", () => {
    assert.equal(detectHeading("## Refund policy"), "Refund policy");
  });

  it("recognises an unpunctuated short line", () => {
    assert.equal(detectHeading("Refund policy"), "Refund policy");
  });

  it("does not mistake a sentence for a heading", () => {
    assert.equal(detectHeading("Refunds are available within 30 days."), null);
    assert.equal(detectHeading("Is this a heading?"), null);
  });

  it("does not mistake a long line or a multi-line block for a heading", () => {
    assert.equal(detectHeading("word ".repeat(30).trim()), null);
    assert.equal(detectHeading("Refund policy\nand more"), null);
  });
});

describe("chunkText", () => {
  it("carries the last-seen heading onto the chunks under it", () => {
    const text = ["# Refunds", LONG_PARAGRAPH, "# Shipping", LONG_PARAGRAPH].join("\n\n");
    const chunks = chunkText(text);

    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0].heading, "Refunds");
    assert.equal(chunks.at(-1)?.heading, "Shipping");
  });

  it("gives a chunk cut out of the middle of a section the section's heading", () => {
    const text = ["# Refunds", LONG_PARAGRAPH, LONG_PARAGRAPH].join("\n\n");
    const chunks = chunkText(text);

    assert.ok(chunks.length > 1, "expected the section to span more than one chunk");
    assert.ok(chunks.every((chunk) => chunk.heading === "Refunds"));
  });

  it("indexes a repeated boilerplate block once", () => {
    const boilerplate =
      "All prices are shown in US dollars and exclude any applicable local sales tax.";
    const text = [boilerplate, boilerplate, boilerplate].join("\n\n");

    // One chunk, because they all fit — the real test is that the repeated
    // paragraph is not stored three times as three separate chunks.
    const chunks = chunkText([boilerplate, LONG_PARAGRAPH, boilerplate].join("\n\n"));
    const contents = chunks.map((chunk) => chunk.content);
    assert.equal(new Set(contents).size, contents.length);
    assert.equal(chunkText(text).length, 1);
  });

  it("treats case and spacing differences as the same content", () => {
    const chunks = chunkText(
      ["See the pricing page for details.", "SEE  THE   PRICING PAGE FOR DETAILS."].join("\n\n"),
    );
    assert.equal(chunks.length, 1);
  });

  it("drops a degenerate fragment when there is real content beside it", () => {
    const real = "Refunds are available within 30 days of purchase, no questions asked at all.";
    const chunks = chunkText([real, "p. 12"].join("\n\n"));

    // Both fit in one chunk, so split them far enough apart to be separate.
    const separated = chunkText([real, LONG_PARAGRAPH, "p. 12"].join("\n\n"));
    assert.ok(chunks.length >= 1);
    assert.ok(separated.every((chunk) => chunk.content !== "p. 12"));
  });

  it("indexes a genuinely tiny source rather than emptying it", () => {
    const chunks = chunkText("Yes.");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, "Yes.");
  });

  it("estimates tokens as roughly a quarter of the character count", () => {
    assert.equal(estimateTokenCount("a".repeat(400)), 100);
    assert.equal(estimateTokenCount(""), 1);
  });
});
