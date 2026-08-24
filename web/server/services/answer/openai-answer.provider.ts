import { creditCost } from "lib/plans";
import { getOpenAIClient } from "server/services/openai-chat.service";
import { isAbortError, withProviderRetry } from "server/services/provider-retry";

import { ANSWER_BUDGET } from "./budget";
import { buildContextMessage, buildSystemPrompt, isFallbackAnswer } from "./prompt";
import { citationsFromChunks, type AnswerEvent, type AnswerProvider, type AnswerRequest } from "./types";

export const openAiAnswerProvider: AnswerProvider = {
  async *answer(request: AnswerRequest): AsyncIterable<AnswerEvent> {
    const citations = citationsFromChunks(request.chunks);

    // Nothing relevant was retrieved. Saying so is the product behaviour we want,
    // and it costs nothing — so we never call the model for it.
    if (request.chunks.length === 0) {
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

    yield { type: "start", citations };

    const client = getOpenAIClient();

    try {
      // Only the call that opens the stream is retried. Once a delta has
      // reached the visitor there is no safe way to start over — the answer
      // they are reading would restart mid-sentence — so a failure after that
      // point has to be a failure.
      const stream = await withProviderRetry(
        () =>
          client.chat.completions.create(
            {
              model: request.model,
              max_tokens: ANSWER_BUDGET.outputTokens,
              stream: true,
              stream_options: { include_usage: true },
              messages: [
                { role: "system", content: buildSystemPrompt(request) },
                { role: "user", content: buildContextMessage(request.chunks, citations) },
                ...request.history.map((message) => ({
                  role: message.role,
                  content: message.content,
                })),
                { role: "user", content: request.question },
              ],
            },
            // Without this the completion keeps generating — and billing —
            // after the visitor has closed the widget.
            { signal: request.signal },
          ),
        "answer/openai",
      );

      let tokens = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let answerText = "";

      for await (const part of stream) {
        const delta = part.choices[0]?.delta?.content;
        if (delta) {
          answerText += delta;
          yield { type: "delta", text: delta };
        }
        // The usage chunk arrives last and carries no choices.
        if (part.usage) {
          tokens = part.usage.total_tokens ?? 0;
          inputTokens = part.usage.prompt_tokens ?? 0;
          outputTokens = part.usage.completion_tokens ?? 0;
        }
      }

      // "The model was called" is not the same as "the visitor got an answer".
      // The retrieval rule deliberately passes weak, tangentially-related
      // chunks so the model can be the final judge, and when it judges against
      // them it returns the fallback sentence. Charging for that reads as a bug
      // to the customer, so refusing — not the call — is what decides.
      const grounded = !isFallbackAnswer(answerText, request.fallbackMessage);

      yield {
        type: "done",
        answered: grounded,
        status: grounded ? "answered" : "abstained",
        usage: {
          tokens,
          inputTokens,
          outputTokens,
          credits: grounded ? creditCost(request.model) : 0,
        },
      };
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("[answer/openai]", error);
      yield {
        type: "error",
        code: "PROVIDER_FAILED",
        message: "The assistant could not finish this answer. Please try again.",
      };
    }
  },
};
