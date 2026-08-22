import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { env } from "server/env";

import { openAiAnswerProvider } from "./openai-answer.provider";
import { stubAnswerProvider } from "./stub-answer.provider";
import type { AnswerEvent, AnswerProvider, AnswerRequest } from "./types";

/**
 * Runs the same assertions against whichever provider it is handed. If a
 * behaviour needs a special case per provider, the interface has already
 * leaked — see DEV_PLAN.md §1. Uses Node's built-in test runner: `npm test`
 * for the stub half, `npm run test:live` to include the real API — the live
 * suite skips itself unless a key is in the environment, and `npm test` never
 * loads `.env.local`, so the verification gate stays offline.
 */
function contractTests(provider: AnswerProvider) {
  const baseRequest: AnswerRequest = {
    question: "What is the refund window?",
    history: [],
    chunks: [
      {
        id: "chunk-1",
        sourceId: "source-1",
        sourceTitle: "Refunds",
        sourceUrl: null,
        content: "Refunds are available within 30 days of purchase, no questions asked.",
        score: 0.9,
      },
    ],
    model: "gpt-4o-mini",
    botInstruction: null,
    tone: "friendly",
    fallbackMessage: "I don't have an answer for that yet — want to leave your email?",
  };

  async function collect(request: AnswerRequest): Promise<AnswerEvent[]> {
    const events: AnswerEvent[] = [];
    for await (const event of provider.answer(request)) events.push(event);
    return events;
  }

  it("streams a start with real citations, at least one delta, then done", async () => {
    const events = await collect(baseRequest);

    const start = events[0];
    assert.equal(start.type, "start");
    assert.equal(start.type === "start" && start.citations[0]?.sourceId, "source-1");

    assert.ok(events.filter((e) => e.type === "delta").length > 0);

    const last = events.at(-1);
    assert.equal(last?.type, "done");
    assert.equal(last?.type === "done" && last.answered, true);
    assert.equal(last?.type === "done" && last.status, "answered");
  });

  it("an answer that cites nothing is an abstention, and costs nothing", async () => {
    // The provider is told the only chunk is unrelated to the question, so a
    // correct model declines to answer — and a declined answer must not be
    // billed as one. The stub always cites, so this holds it to the same rule
    // by asserting on the pairing rather than on the text.
    const events = await collect({
      ...baseRequest,
      question: "How tall is the Eiffel Tower?",
    });

    const last = events.at(-1);
    assert.equal(last?.type, "done");
    if (last?.type !== "done") return;
    assert.equal(last.answered, last.status === "answered");
    assert.equal(last.usage.credits > 0, last.answered);
  });

  it("answers with the fallback and spends nothing when nothing was retrieved", async () => {
    const events = await collect({ ...baseRequest, chunks: [] });

    const start = events[0];
    assert.equal(start.type, "start");
    assert.deepEqual(start.type === "start" && start.citations, []);

    const text = events
      .filter((e): e is Extract<AnswerEvent, { type: "delta" }> => e.type === "delta")
      .map((e) => e.text)
      .join("");
    assert.equal(text, baseRequest.fallbackMessage);

    const last = events.at(-1);
    assert.equal(last?.type, "done");
    assert.deepEqual(
      last?.type === "done" && [last.answered, last.status, last.usage],
      [false, "no_context", { tokens: 0, inputTokens: 0, outputTokens: 0, credits: 0 }],
    );
  });
}

describe("stub provider", () => contractTests(stubAnswerProvider));

// Exercises the real API when a key is configured; skipped otherwise so this
// suite stays runnable without one (see DEV_PLAN.md §1).
describe("openai provider (live)", { skip: !env.openaiApiKey }, () => contractTests(openAiAnswerProvider));
