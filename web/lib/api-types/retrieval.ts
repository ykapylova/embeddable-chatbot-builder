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

export type RetrievalDebugBody = { question: string };
export type RetrievalDebugResponse = { chunks: RetrievedChunk[] };
