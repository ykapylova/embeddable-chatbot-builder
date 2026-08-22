import { env } from "server/env";

import { openAiAnswerProvider } from "./openai-answer.provider";
import { stubAnswerProvider } from "./stub-answer.provider";
import type { AnswerProvider } from "./types";

export { escapeSourceTags, usedCitations } from "./prompt";
export { ANSWER_BUDGET } from "./budget";

/**
 * The only place `ANSWER_PROVIDER` is read. Everything downstream depends on
 * `AnswerProvider` alone, so no caller ever branches on which one it got.
 */
export function getAnswerProvider(): AnswerProvider {
  return env.answerProvider === "stub" ? stubAnswerProvider : openAiAnswerProvider;
}

export type {
  AnswerEvent,
  AnswerStatus,
  AnswerHistoryMessage,
  AnswerProvider,
  AnswerRequest,
  AnswerUsage,
  Citation,
  RetrievedChunk,
  SimulationMode,
} from "./types";
