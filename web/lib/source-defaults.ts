/**
 * Client-facing mirror of `server/limits.ts` — the server is still what
 * enforces these, but the add-source form needs the same numbers to validate
 * before an upload leaves the browser and to word its hints correctly.
 */
export const SOURCE_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const SOURCE_FILE_ALLOWED_EXTENSIONS = ["pdf", "txt", "md"] as const;
export type SourceFileExtension = (typeof SOURCE_FILE_ALLOWED_EXTENSIONS)[number];

export const SOURCE_TITLE_MAX = 200;
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
