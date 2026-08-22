/**
 * Every input to the answer prompt, in one place.
 *
 * These four numbers used to live in four unrelated files, so the context
 * ceiling was a coincidence rather than a decision: raising the retrieval
 * limit for better recall would have doubled the prompt with nothing to
 * notice. Naming them together — and asserting the sum in `budget.test.ts` —
 * is what makes the ceiling a thing anyone can see.
 */
export const ANSWER_BUDGET = {
  /** Chunks passed to the model, and the cap retrieval trims to. */
  contextChunks: 5,
  /** Chunking targets this size, so a chunk never exceeds it by much. */
  chunkTokens: 800,
  /** Conversation turns replayed into the prompt (PROJECT_SPEC.md §8). */
  historyMessages: 4,
  /** Longest question either chat endpoint accepts. */
  questionChars: 4000,
  /** Answers are short by design; a long one means the prompt went wrong. */
  outputTokens: 600,
  /** The standing rules, the tone line and the bot's own instruction. */
  instructionTokens: 700,
  /** A replayed turn is bounded by the output cap on our side and the question cap on theirs. */
  historyMessageTokens: 600,
} as const;

const CHARS_PER_TOKEN = 4;

/** The worst case one request can send, in tokens. Nothing may exceed `CONTEXT_CEILING_TOKENS`. */
export const MAX_PROMPT_TOKENS =
  ANSWER_BUDGET.instructionTokens +
  ANSWER_BUDGET.contextChunks * ANSWER_BUDGET.chunkTokens +
  ANSWER_BUDGET.historyMessages * ANSWER_BUDGET.historyMessageTokens +
  Math.ceil(ANSWER_BUDGET.questionChars / CHARS_PER_TOKEN);

export const MAX_REQUEST_TOKENS = MAX_PROMPT_TOKENS + ANSWER_BUDGET.outputTokens;

/**
 * The smallest context window any model in `PLAN_LIMITS` offers, less a margin.
 * The budget must fit here, not in the largest window available.
 */
export const CONTEXT_CEILING_TOKENS = 16_000;
