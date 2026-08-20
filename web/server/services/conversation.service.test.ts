import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decodeCursor, encodeCursor, toRating } from "./conversation.service";

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
