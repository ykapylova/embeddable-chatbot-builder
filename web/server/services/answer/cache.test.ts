import assert from "node:assert/strict";
import { test } from "node:test";

import { hashQuestion, isCacheEligible, normalizeQuestion } from "./cache";

test("normalisation folds case, spacing and trailing punctuation together", () => {
  const forms = [
    "What are your support hours?",
    "what are your   support hours",
    "  WHAT ARE YOUR SUPPORT HOURS?!  ",
  ];
  const normalized = forms.map(normalizeQuestion);
  assert.equal(new Set(normalized).size, 1, "all three should share one cache key");
  assert.equal(normalized[0], "what are your support hours");
});

test("normalisation keeps distinct questions distinct", () => {
  assert.notEqual(
    normalizeQuestion("Do you offer refunds?"),
    normalizeQuestion("Do you offer discounts?"),
  );
});

test("the hash is stable and separates different questions", () => {
  assert.equal(hashQuestion("what are your support hours"), hashQuestion("what are your support hours"));
  assert.notEqual(hashQuestion("refunds"), hashQuestion("discounts"));
});

test("only a first turn is cache eligible", () => {
  assert.equal(isCacheEligible([]), true);
  assert.equal(isCacheEligible([{ role: "user", content: "hi" }]), false);
});
