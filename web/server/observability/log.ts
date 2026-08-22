/**
 * One structured line per notable event, so a slow or wrong answer can be
 * traced instead of guessed at. Every line carries the `requestId` minted at
 * the top of the request, which is what ties the stages of one turn together
 * in a log search.
 *
 * Deliberately `console` and not a logging library: Vercel collects stdout,
 * and a dependency that only reformats JSON is not worth the install.
 */
type Fields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", event: string, fields: Fields): void {
  const line = JSON.stringify({ event, level, at: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logEvent(event: string, fields: Fields = {}): void {
  emit("info", event, fields);
}

export function logRefusal(event: string, fields: Fields = {}): void {
  emit("warn", event, fields);
}

export function logFailure(event: string, error: unknown, fields: Fields = {}): void {
  emit("error", event, {
    ...fields,
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
}
