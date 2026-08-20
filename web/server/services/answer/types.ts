import type { ModelId } from "lib/plans";

/** A chunk of the knowledge base selected by vector search. */
export type RetrievedChunk = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string | null;
  content: string;
  /** Cosine similarity, 0..1. */
  score: number;
};

/**
 * A source shown under an answer. Citations come from retrieval, not from the
 * model, so they are trustworthy even when the model phrases things loosely.
 */
export type Citation = {
  /** The [n] marker used in the answer text. */
  index: number;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string | null;
};

export type AnswerHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AnswerRequest = {
  question: string;
  history: AnswerHistoryMessage[];
  chunks: RetrievedChunk[];
  model: ModelId;
  /** The bot's own instruction, appended to the standing rules. */
  botInstruction: string | null;
  tone: string;
  /** Used verbatim when nothing relevant was retrieved. */
  fallbackMessage: string;
};

export type AnswerUsage = {
  tokens: number;
  credits: number;
};

export type AnswerEvent =
  | { type: "start"; citations: Citation[] }
  | { type: "delta"; text: string }
  | { type: "done"; answered: boolean; usage: AnswerUsage }
  | { type: "error"; code: string; message: string };

export interface AnswerProvider {
  answer(request: AnswerRequest): AsyncIterable<AnswerEvent>;
}

/**
 * Failure modes the stub can be asked to reproduce. On a live model these are
 * caught by luck; here they are deterministic, which is the only reason the
 * stub exists.
 */
export type SimulationMode = "error" | "slow" | "empty";

export function citationsFromChunks(chunks: RetrievedChunk[]): Citation[] {
  const seen = new Map<string, Citation>();

  for (const chunk of chunks) {
    if (seen.has(chunk.sourceId)) continue;
    seen.set(chunk.sourceId, {
      index: seen.size + 1,
      sourceId: chunk.sourceId,
      sourceTitle: chunk.sourceTitle,
      sourceUrl: chunk.sourceUrl,
    });
  }

  return [...seen.values()];
}
