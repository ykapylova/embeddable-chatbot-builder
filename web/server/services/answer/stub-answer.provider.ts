import { creditCost } from "lib/plans";

import { citationsFromChunks, type AnswerEvent, type AnswerProvider, type AnswerRequest } from "./types";

/**
 * Markers a test question can contain to force a `SimulationMode`. Real
 * questions never contain them, so this is a safe way to drive the stub
 * deterministically from the same request shape the real provider takes —
 * no extra field on `AnswerRequest` needed.
 */
const SIMULATION_MARKERS = {
  error: "__stub:error__",
  slow: "__stub:slow__",
  empty: "__stub:empty__",
} as const;

function detectSimulationMode(question: string): keyof typeof SIMULATION_MARKERS | null {
  const lower = question.toLowerCase();
  for (const mode of Object.keys(SIMULATION_MARKERS) as (keyof typeof SIMULATION_MARKERS)[]) {
    if (lower.includes(SIMULATION_MARKERS[mode])) return mode;
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One citation marker per chunk, so composed answers cite real, checkable sources. */
function composeAnswer(request: AnswerRequest, citations: ReturnType<typeof citationsFromChunks>): string {
  const indexBySource = new Map(citations.map((c) => [c.sourceId, c.index]));

  const sentences = request.chunks.map((chunk) => {
    const marker = indexBySource.get(chunk.sourceId);
    const snippet = chunk.content.trim().split(/\s+/).slice(0, 16).join(" ");
    return marker ? `${snippet} [${marker}]` : snippet;
  });

  return `Stub answer for "${request.question}". ${sentences.join(" ")}`;
}

/** Rough token estimate from text length — the real provider gets this from the API response. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Splits into pieces that keep their trailing whitespace, so joining deltas reproduces the text exactly. */
function toPieces(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

/**
 * Test double for `AnswerProvider`. Composes its answer from the retrieved
 * chunks so citations stay real, streams it piece by piece with a delay, and
 * can be told to fail, slow down, or find nothing — see `DEV_PLAN.md` §1.
 */
export const stubAnswerProvider: AnswerProvider = {
  async *answer(request: AnswerRequest): AsyncIterable<AnswerEvent> {
    const mode = detectSimulationMode(request.question);

    if (mode === "empty" || request.chunks.length === 0) {
      yield { type: "start", citations: [] };
      yield { type: "delta", text: request.fallbackMessage };
      yield {
        type: "done",
        answered: false,
        status: "no_context",
        usage: { tokens: 0, inputTokens: 0, outputTokens: 0, credits: 0 },
      };
      return;
    }

    const citations = citationsFromChunks(request.chunks);
    yield { type: "start", citations };

    const pieceDelayMs = mode === "slow" ? 250 : 15;
    const answer = composeAnswer(request, citations);
    const pieces = toPieces(answer);

    const errorAfterPieces = mode === "error" ? Math.ceil(pieces.length / 2) : -1;

    for (let i = 0; i < pieces.length; i++) {
      await delay(pieceDelayMs);
      if (i === errorAfterPieces) {
        yield {
          type: "error",
          code: "SIMULATED_ERROR",
          message: "The assistant could not finish this answer. Please try again.",
        };
        return;
      }
      yield { type: "delta", text: pieces[i] };
    }

    const tokens = estimateTokens(answer);
    yield {
      type: "done",
      answered: true,
      status: "answered",
      usage: {
        tokens,
        inputTokens: estimateTokens(request.chunks.map((c) => c.content).join(" ")),
        outputTokens: tokens,
        credits: creditCost(request.model),
      },
    };
  },
};
