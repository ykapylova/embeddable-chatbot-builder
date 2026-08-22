import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ANSWER_BUDGET,
  CONTEXT_CEILING_TOKENS,
  MAX_REQUEST_TOKENS,
} from "./budget";

test("the whole answer budget fits the smallest supported context window", () => {
  assert.ok(
    MAX_REQUEST_TOKENS < CONTEXT_CEILING_TOKENS,
    `budget of ${MAX_REQUEST_TOKENS} tokens exceeds the ${CONTEXT_CEILING_TOKENS} ceiling`,
  );
});

test("one more retrieved chunk would still fit", () => {
  // Retrieval breadth is the knob most likely to be turned for better recall,
  // so the ceiling has to leave room for turning it — otherwise the next
  // person to raise `contextChunks` breaks the budget and finds out in
  // production rather than here.
  const headroom = CONTEXT_CEILING_TOKENS - MAX_REQUEST_TOKENS;
  assert.ok(
    headroom >= ANSWER_BUDGET.chunkTokens,
    `only ${headroom} tokens of headroom, less than one ${ANSWER_BUDGET.chunkTokens}-token chunk`,
  );
});
