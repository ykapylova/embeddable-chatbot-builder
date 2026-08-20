import { creditCost } from "lib/plans";
import { getOpenAIClient } from "server/services/openai-chat.service";

import { buildSystemPrompt } from "./prompt";
import { citationsFromChunks, type AnswerEvent, type AnswerProvider, type AnswerRequest } from "./types";

/** Answers are short by design; a long one is a sign the prompt went wrong. */
const MAX_OUTPUT_TOKENS = 600;

export const openAiAnswerProvider: AnswerProvider = {
  async *answer(request: AnswerRequest): AsyncIterable<AnswerEvent> {
    const citations = citationsFromChunks(request.chunks);

    // Nothing relevant was retrieved. Saying so is the product behaviour we want,
    // and it costs nothing — so we never call the model for it.
    if (request.chunks.length === 0) {
      yield { type: "start", citations: [] };
      yield { type: "delta", text: request.fallbackMessage };
      yield { type: "done", answered: false, usage: { tokens: 0, credits: 0 } };
      return;
    }

    yield { type: "start", citations };

    const client = getOpenAIClient();

    try {
      const stream = await client.chat.completions.create({
        model: request.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: "system", content: buildSystemPrompt(request, citations) },
          ...request.history.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          { role: "user", content: request.question },
        ],
      });

      let tokens = 0;

      for await (const part of stream) {
        const delta = part.choices[0]?.delta?.content;
        if (delta) {
          yield { type: "delta", text: delta };
        }
        // The usage chunk arrives last and carries no choices.
        if (part.usage) {
          tokens = part.usage.total_tokens ?? 0;
        }
      }

      yield {
        type: "done",
        answered: true,
        usage: { tokens, credits: creditCost(request.model) },
      };
    } catch (error) {
      console.error("[answer/openai]", error);
      yield {
        type: "error",
        code: "PROVIDER_FAILED",
        message: "The assistant could not finish this answer. Please try again.",
      };
    }
  },
};
