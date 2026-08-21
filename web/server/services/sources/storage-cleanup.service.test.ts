import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blobPathsToDiscard } from "./storage-cleanup.service";

describe("blobPathsToDiscard", () => {
  it("keeps only the sources that actually own a blob", () => {
    // URL sources store nothing — passing their null key to the bucket would
    // be a delete request for the object named "null".
    const paths = blobPathsToDiscard(["sources/bot/a/original.pdf", null, "sources/bot/b/content.txt"]);
    assert.deepEqual(paths, ["sources/bot/a/original.pdf", "sources/bot/b/content.txt"]);
  });

  it("returns nothing when a bot has no stored content at all", () => {
    assert.deepEqual(blobPathsToDiscard([null, undefined]), []);
  });

  it("never asks for the same object twice", () => {
    assert.deepEqual(blobPathsToDiscard(["sources/bot/a.txt", "sources/bot/a.txt"]), ["sources/bot/a.txt"]);
  });
});
