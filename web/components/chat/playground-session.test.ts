import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ConversationMessage } from "lib/api-types/conversation";

import { sessionFromTranscript } from "./playground-session";

function message(partial: Partial<ConversationMessage> & Pick<ConversationMessage, "id" | "role">): ConversationMessage {
  return {
    content: "",
    citations: [],
    rating: null,
    createdAt: "2026-08-21T10:00:00.000Z",
    ...partial,
  };
}

describe("sessionFromTranscript", () => {
  it("keeps the conversation id, so the next turn continues it", () => {
    const session = sessionFromTranscript("conv-1", []);

    assert.equal(session.conversationId, "conv-1");
    assert.deepEqual(session.messages, []);
  });

  it("gives every answer the question it replied to", () => {
    const session = sessionFromTranscript("conv-1", [
      message({ id: "1", role: "user", content: "What are your hours?" }),
      message({ id: "2", role: "assistant", content: "Nine to five." }),
      message({ id: "3", role: "user", content: "On Saturdays too?" }),
      message({ id: "4", role: "assistant", content: "No." }),
    ]);

    const answers = session.messages.filter((m) => m.role === "assistant");
    // `forQuestion` is what Retry resends — pairing it with the wrong question
    // would silently ask something else.
    assert.deepEqual(
      answers.map((m) => (m.role === "assistant" ? m.forQuestion : null)),
      ["What are your hours?", "On Saturdays too?"],
    );
  });

  it("restores answers as finished, never mid-stream", () => {
    const session = sessionFromTranscript("conv-1", [
      message({ id: "1", role: "user", content: "Hi" }),
      message({ id: "2", role: "assistant", content: "Hello", rating: "up" }),
    ]);

    const answer = session.messages[1];
    assert.equal(answer.role === "assistant" && answer.status, "done");
    assert.equal(answer.role === "assistant" && answer.rating, "up");
  });

  it("survives a transcript that opens with an answer", () => {
    const session = sessionFromTranscript("conv-1", [
      message({ id: "1", role: "assistant", content: "Orphaned reply" }),
    ]);

    const answer = session.messages[0];
    assert.equal(answer.role === "assistant" && answer.forQuestion, "");
  });
});
