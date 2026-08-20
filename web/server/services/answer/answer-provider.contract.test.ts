import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { env } from "server/env";

import { openAiAnswerProvider } from "./openai-answer.provider";
import { stubAnswerProvider } from "./stub-answer.provider";
import type { AnswerEvent, AnswerProvider, AnswerRequest } from "./types";

/**
 * Runs the same assertions against whichever provider it is handed. If a
 * behaviour needs a special case per provider, the interface has already
 * leaked — see DEV_PLAN.md §1. Uses Node's built-in test runner so this file
 * needs no extra dependency; run it with `node --test` once TS execution is
 * wired up (see the PR description).
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
      last?.type === "done" && [last.answered, last.usage],
      [false, { tokens: 0, credits: 0 }],
    );
  });
}

describe("stub provider", () => contractTests(stubAnswerProvider));

// Exercises the real API when a key is configured; skipped otherwise so this
// suite stays runnable without one (see DEV_PLAN.md §1).
describe("openai provider (live)", { skip: !env.openaiApiKey }, () => contractTests(openAiAnswerProvider));
