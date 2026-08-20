/**
 * Mirrors the `RetrievedChunk` shape from the seam contract in `DEV_PLAN.md`
 * (`server/services/answer/types.ts`). That file lives on the unmerged
 * `feat/phase-4-chat` branch, so this is a standalone copy until it merges —
 * the two must stay identical.
 */
export type RetrievedChunk = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  content: string;
  score: number;
};

export type RetrievalDebugBody = { question: string };
export type RetrievalDebugResponse = { chunks: RetrievedChunk[] };
