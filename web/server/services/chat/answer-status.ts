import type { AnswerStatus } from "server/services/answer";

/**
 * What actually gets written to `messages.answer_status`: the answer layer's
 * own outcomes plus the three only the route can observe — a quota refusal,
 * a visitor who left mid-stream, and a failure.
 *
 * Recording this at write time is what separates a genuine content gap from a
 * forgotten citation marker. Inferring it later from an empty citations array
 * put correct-but-uncited answers on the Content Gaps screen.
 */
export type StoredAnswerStatus = AnswerStatus | "quota" | "aborted" | "error";

/** The statuses the Content Gaps screen counts as the knowledge base falling short. */
export const CONTENT_GAP_STATUSES: readonly StoredAnswerStatus[] = ["abstained", "no_context"];

export function isContentGap(status: StoredAnswerStatus | null): boolean {
  return status !== null && CONTENT_GAP_STATUSES.includes(status);
}
