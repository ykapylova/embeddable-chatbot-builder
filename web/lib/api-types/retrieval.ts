/**
 * The client-side mirror of the seam contract in
 * `server/services/answer/types.ts`. Two declarations rather than one import
 * because this one crosses to the browser; they must stay identical, and they
 * had already drifted once — `sourceUrl` existed on the server side while the
 * debug panel could not see it.
 */
export type RetrievedChunk = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string | null;
  content: string;
  score: number;
};

/**
 * Why the answer path would not have used this chunk. `null` means it would
 * have — the panel is useless if a rejected hit and an empty knowledge base
 * look the same, which is exactly what it used to show.
 */
export type RetrievalRejection = "below_floor" | "outside_margin" | "over_limit";

export type RetrievalCandidate = RetrievedChunk & {
  kept: boolean;
  rejectedBecause: RetrievalRejection | null;
};

export type RetrievalDebugBody = { question: string };
export type RetrievalDebugResponse = {
  candidates: RetrievalCandidate[];
  /** The rule in force, so the panel can explain a rejection in the numbers it actually used. */
  rule: { floor: number; margin: number };
};
