/** A readable, user-facing reason a source's content could not be processed —
 * shown directly in `sources.error`. Anything else is logged and replaced
 * with a generic message so internals never leak to the account owner. */
export class SourceContentError extends Error {}

/** Invalid input to a source-creation request — mapped to a 422. */
export class SourceValidationError extends Error {}
