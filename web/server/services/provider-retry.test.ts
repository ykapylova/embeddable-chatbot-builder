import assert from "node:assert/strict";
import { test } from "node:test";

import { isAbortError, isRetryableProviderError, withProviderRetry } from "./provider-retry";

function apiError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

test("rate limits, timeouts and server errors are retried", () => {
  for (const status of [408, 409, 429, 500, 502, 503, 529]) {
    assert.equal(isRetryableProviderError(apiError(status)), true, `status ${status}`);
  }
});

test("a request that will fail identically the second time is not retried", () => {
  for (const status of [400, 401, 403, 404, 413, 422]) {
    assert.equal(isRetryableProviderError(apiError(status)), false, `status ${status}`);
  }
});

test("a dropped socket is retried, a plain bug is not", () => {
  assert.equal(
    isRetryableProviderError(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" })),
    true,
  );
  assert.equal(isRetryableProviderError(new TypeError("x is not a function")), false);
});

test("a network code buried in `cause` still counts", () => {
  const error = Object.assign(new Error("fetch failed"), {
    cause: Object.assign(new Error("timeout"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
  });
  assert.equal(isRetryableProviderError(error), true);
});

test("the visitor leaving is never a retry", () => {
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  assert.equal(isAbortError(abort), true);
  assert.equal(isRetryableProviderError(abort), false);
});

test("a transient failure succeeds on the next attempt", async () => {
  let calls = 0;
  const value = await withProviderRetry(
    async () => {
      calls += 1;
      if (calls === 1) throw apiError(429);
      return "ok";
    },
    "test",
    [0],
  );
  assert.equal(value, "ok");
  assert.equal(calls, 2);
});

test("retries are bounded and the last error is what the caller sees", async () => {
  let calls = 0;
  await assert.rejects(
    withProviderRetry(
      async () => {
        calls += 1;
        throw apiError(503);
      },
      "test",
      [0, 0],
    ),
    /HTTP 503/,
  );
  assert.equal(calls, 3);
});

test("a permanent failure is not retried at all", async () => {
  let calls = 0;
  await assert.rejects(
    withProviderRetry(
      async () => {
        calls += 1;
        throw apiError(400);
      },
      "test",
      [0, 0],
    ),
    /HTTP 400/,
  );
  assert.equal(calls, 1);
});
