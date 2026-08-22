import type { sourceErrorCodeEnum } from "server/db/schema";

/**
 * Why a source failed, in terms the code around it can branch on. `error`
 * holds the sentence the owner reads; this is the half the UI needs to decide
 * whether to offer Retry (useful after a timeout, useless after a corrupt
 * file) and whether to link to `/billing?reason=…` the way every other plan
 * limit in the app does.
 */
export type SourceErrorCode = (typeof sourceErrorCodeEnum.enumValues)[number];

/** A readable, user-facing reason a source's content could not be processed —
 * shown directly in `sources.error`, with `code` stored alongside it. Anything
 * else is logged and replaced with a generic message so internals never leak
 * to the account owner. */
export class SourceContentError extends Error {
  readonly code: SourceErrorCode;

  constructor(message: string, code: SourceErrorCode) {
    super(message);
    this.name = "SourceContentError";
    this.code = code;
  }
}

/** Invalid input to a source-creation request — mapped to a 422. */
export class SourceValidationError extends Error {}

/** A reindex asked for while one is already running — mapped to a 409. */
export class SourceBusyError extends Error {}
