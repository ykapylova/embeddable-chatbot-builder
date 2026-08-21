import assert from "node:assert/strict";
import { test } from "node:test";

import { selectByMargin } from "./retrieval.service";

const MARGIN = 0.12;

// The scores below are the real measurements recorded in FINDINGS.md against
// `text-embedding-3-small`. Each case is a bug the old absolute 0.35 cutoff
// produced or a fabrication risk the relative rule must still avoid.

test("keeps a strong top hit and drops the noise beneath it", () => {
  // "What are your support hours?": right chunk 0.657, best wrong chunk 0.340.
  const kept = selectByMargin(
    [
      { id: "right", score: 0.657 },
      { id: "noise", score: 0.34 },
    ],
    MARGIN,
  );
  assert.deepEqual(
    kept.map((r) => r.id),
    ["right"],
  );
});

test("keeps a weak but correct top hit the 0.35 cutoff silently dropped", () => {
  // "Do you work on Saturdays?": right chunk 0.296 — verbatim in the docs, yet
  // below 0.35, so the old rule returned nothing and it looked like a gap.
  const kept = selectByMargin(
    [
      { id: "right", score: 0.296 },
      { id: "noise", score: 0.119 },
    ],
    MARGIN,
  );
  assert.deepEqual(
    kept.map((r) => r.id),
    ["right"],
  );
});

test("keeps a CV summary chunk that phrasing alone pushed under the cutoff", () => {
  // "who is Yana": the exact answering paragraph scored 0.313 and fell back;
  // "what is my experience" scored 0.358 and answered. Same content, same chunk.
  const kept = selectByMargin([{ id: "cv", score: 0.313 }], MARGIN);
  assert.deepEqual(
    kept.map((r) => r.id),
    ["cv"],
  );
});

test("keeps close runners-up but excludes those outside the margin", () => {
  const kept = selectByMargin(
    [
      { id: "a", score: 0.62 },
      { id: "b", score: 0.55 }, // within 0.12 of 0.62
      { id: "c", score: 0.49 }, // 0.13 below the top — excluded
      { id: "d", score: 0.3 },
    ],
    MARGIN,
  );
  assert.deepEqual(
    kept.map((r) => r.id),
    ["a", "b"],
  );
});

test("returns nothing when the candidate list is empty", () => {
  // The query applies the absolute floor, so an out-of-corpus question whose
  // best chunk never clears it arrives here as an empty list — and must stay
  // empty, which is what produces the honest 'I don't know'.
  assert.deepEqual(selectByMargin([], MARGIN), []);
});
