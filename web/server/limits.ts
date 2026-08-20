/**
 * Technical upload limits for knowledge sources — file size, MIME allowlist,
 * fetch size/timeout for URLs. These are engineering guardrails, not plan
 * limits: plan limits (bots, sources, chars per plan) live in `lib/plans.ts`.
 */

export const SOURCE_TITLE_MAX = 200;

export const SOURCE_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const SOURCE_FILE_ALLOWED_EXTENSIONS = ["pdf", "txt", "md"] as const;
export type SourceFileExtension = (typeof SOURCE_FILE_ALLOWED_EXTENSIONS)[number];

export const SOURCE_URL_FETCH_MAX_BYTES = 5 * 1024 * 1024;
export const SOURCE_URL_FETCH_TIMEOUT_MS = 15_000;

export const SOURCE_TEXT_MAX_CHARS = 200_000;
export const SOURCE_FAQ_QUESTION_MAX_CHARS = 500;
export const SOURCE_FAQ_ANSWER_MAX_CHARS = 5_000;

export function extensionFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function isAllowedSourceFileExtension(ext: string): ext is SourceFileExtension {
  return (SOURCE_FILE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}
