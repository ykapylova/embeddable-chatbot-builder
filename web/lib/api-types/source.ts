export type SourceType = "file" | "url" | "text" | "faq";
export type SourceStatus = "pending" | "processing" | "ready" | "failed";

/**
 * Why a failed source failed. The sentence in `error` is for the owner to
 * read; this is what the UI branches on — whether Retry is worth offering,
 * and whether the failure is really a plan limit wearing a red sentence.
 */
export type SourceErrorCode =
  | "PARSE_FAILED"
  | "EMBEDDING_FAILED"
  | "TIMEOUT"
  | "UNSUPPORTED_CONTENT"
  | "EMPTY_SOURCE"
  | "STORAGE_FAILED"
  | "LIMIT_CHARS"
  | "UNKNOWN";

/** Trying again cannot change the outcome for these — the file, the format or the plan is the problem. */
export const PERMANENT_SOURCE_ERRORS: readonly SourceErrorCode[] = [
  "UNSUPPORTED_CONTENT",
  "EMPTY_SOURCE",
  "LIMIT_CHARS",
];

export function isRetryableSourceError(code: SourceErrorCode | null): boolean {
  return code === null || !PERMANENT_SOURCE_ERRORS.includes(code);
}

export type Source = {
  id: string;
  botId: string;
  type: SourceType;
  title: string;
  sourceUrl: string | null;
  status: SourceStatus;
  error: string | null;
  errorCode: SourceErrorCode | null;
  charCount: number;
  chunkCount: number;
  createdAt: string;
  indexedAt: string | null;
};

export type CreateUrlSourceBody = { type: "url"; url: string };
export type CreateTextSourceBody = { type: "text"; title: string; content: string };
export type CreateFaqSourceBody = { type: "faq"; question: string; answer: string };

/** Sent as JSON. A `file` source is sent as `multipart/form-data` instead,
 * with fields `type=file`, `file` (the binary) and an optional `title`. */
export type CreateJsonSourceBody = CreateUrlSourceBody | CreateTextSourceBody | CreateFaqSourceBody;
