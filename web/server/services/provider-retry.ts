/**
 * Retrying a transient provider failure is the difference between a bad minute
 * for OpenAI and a bad minute for the customer's visitors. Retrying a
 * permanent one is a spend loop — so this classifies first and retries second.
 *
 * The delays are the reliability document's own: 500ms, 1500ms, then fail.
 */

const RETRY_DELAYS_MS = [500, 1500];

/** Network-level failures surface as an error `code` rather than an HTTP status. */
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function readStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") return code;
  const cause = (error as { cause?: unknown }).cause;
  return cause && cause !== error ? readCode(cause) : null;
}

/** An abort is the visitor leaving, not a failure — it must never be retried. */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === "AbortError" || error.name === "APIUserAbortError")
  );
}

/**
 * 429 and 5xx are the provider asking us to come back; 408 and a dropped
 * socket are the request never having landed. Everything else — a malformed
 * request, a bad key, a missing model — will fail identically on the second
 * attempt.
 */
export function isRetryableProviderError(error: unknown): boolean {
  if (isAbortError(error)) return false;

  const status = readStatus(error);
  if (status !== null) return status === 408 || status === 409 || status === 429 || status >= 500;

  const code = readCode(error);
  if (code && RETRYABLE_NETWORK_CODES.has(code)) return true;

  // The OpenAI SDK reports a failure to reach the API at all as a connection
  // error with no status, which is exactly the case worth retrying.
  return error instanceof Error && error.name.startsWith("APIConnection");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `operation`, retrying only classified-transient failures. `label` is
 * the log prefix — a retry that never gets logged is a latency mystery later.
 */
export async function withProviderRetry<T>(
  operation: (attempt: number) => Promise<T>,
  label: string,
  delaysMs: readonly number[] = RETRY_DELAYS_MS,
): Promise<T> {
  let attempt = 0;

  for (;;) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= delaysMs.length || !isRetryableProviderError(error)) throw error;
      console.warn(
        `[${label}] transient provider failure, retrying`,
        JSON.stringify({ attempt: attempt + 1, delayMs: delaysMs[attempt] }),
      );
      await sleep(delaysMs[attempt]);
      attempt += 1;
    }
  }
}
