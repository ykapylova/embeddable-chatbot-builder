import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decodeCursor, encodeCursor, ratingValue, toRating } from "./conversation.service";

describe("encodeCursor / decodeCursor", () => {
  it("round-trips lastMessageAt and id", () => {
    const cursor = encodeCursor({ lastMessageAt: "2026-01-01T00:00:00.000Z", id: "conv-1" });
    assert.deepEqual(decodeCursor(cursor), { lastMessageAt: "2026-01-01T00:00:00.000Z", id: "conv-1" });
  });

  it("returns null for garbage input rather than throwing", () => {
    assert.equal(decodeCursor("not-a-real-cursor"), null);
  });

  it("returns null when a required part is missing", () => {
    const cursor = Buffer.from("only-one-part", "utf8").toString("base64url");
    assert.equal(decodeCursor(cursor), null);
  });
});

describe("toRating", () => {
  it("maps the stored smallint to up/down/null", () => {
    assert.equal(toRating(1), "up");
    assert.equal(toRating(-1), "down");
    assert.equal(toRating(null), null);
    assert.equal(toRating(0), null);
  });
});

describe("ratingValue", () => {
  // The conversation list's down-rated filter matches `rating = -1` in SQL, so
  // a thumb that maps to anything else is a rating the dashboard never finds.
  it("maps a thumb to the smallint the down-rated filter looks for", () => {
    assert.equal(ratingValue("down"), -1);
    assert.equal(ratingValue("up"), 1);
  });

  it("clears the rating for null, so an un-pressed thumb stops matching", () => {
    assert.equal(ratingValue(null), null);
  });

  it("round-trips through toRating", () => {
    for (const rating of ["up", "down", null] as const) {
      assert.equal(toRating(ratingValue(rating)), rating);
    }
  });
});
