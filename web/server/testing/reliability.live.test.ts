import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { answerCacheRepository } from "server/repositories/answer-cache.repository";
import { chunkRepository } from "server/repositories/chunk.repository";
import { conversationRepository } from "server/repositories/conversation.repository";
import { sourceRepository } from "server/repositories/source.repository";
import { usageRepository } from "server/repositories/usage.repository";
import { botService } from "server/services/bot.service";

import { hasDatabase, seedTwoTenants, unitVector, type Fixture } from "./fixture";

/**
 * §6, §8, §12 and §18 of the reliability document, against the real database:
 * the behaviours that only exist as a race, a constraint or a transaction, and
 * so cannot be tested over in-memory functions.
 *
 * Skipped without `DATABASE_URL`; `npm run test:live` supplies one.
 */
describe("indexing, idempotency and quota", { skip: hasDatabase ? false : "no DATABASE_URL" }, () => {
  let fixture: Fixture;

  before(async () => {
    fixture = await seedTwoTenants("reliability");
  });

  // Several of these deliberately leave a source claimed for indexing, which
  // is the very state the next one has to start from a clean version of.
  beforeEach(async () => {
    if (!hasDatabase || !fixture) return;
    await sourceRepository.update(fixture.a.sourceId, fixture.a.botId, { status: "ready" });
  });

  after(async () => {
    await fixture?.cleanup();
  });

  it("refuses a second indexing run while the first is still going", async () => {
    const first = await sourceRepository.beginIndexing(fixture.a.sourceId, fixture.a.botId);
    assert.ok(first, "the first run should claim the source");

    const second = await sourceRepository.beginIndexing(fixture.a.sourceId, fixture.a.botId);
    assert.equal(second, null, "a second Retry must not start a duplicate run");

    // And the claim bumped the version the run has to commit against.
    assert.ok(first.indexVersion > 0);
    assert.equal(first.status, "processing");
  });

  it("a superseded run discards its own results instead of overwriting fresher ones", async () => {
    const stale = await sourceRepository.findOwned(fixture.a.sourceId, fixture.a.botId);
    assert.ok(stale);
    const staleVersion = stale.indexVersion;

    // Someone reindexes while the stale run is still embedding.
    const fresh = await sourceRepository.beginIndexing(fixture.a.sourceId, fixture.a.botId);
    assert.ok(fresh);

    const rejected = await sourceRepository.replaceChunksAndMarkReady(
      fixture.a.sourceId,
      fixture.a.botId,
      [{ content: "stale content", tokenCount: 3, embedding: unitVector(9), metadata: {} }],
      { charCount: 13, chunkCount: 1, indexVersion: staleVersion },
    );
    assert.equal(rejected, null, "the stale run must lose");

    const chunks = await chunkRepository.findRelevant(fixture.a.botId, unitVector(9), {
      limit: 10,
      minScore: 0,
    });
    assert.ok(!chunks.some((chunk) => chunk.content === "stale content"));

    const accepted = await sourceRepository.replaceChunksAndMarkReady(
      fixture.a.sourceId,
      fixture.a.botId,
      [{ content: "fresh content", tokenCount: 3, embedding: unitVector(9), metadata: { heading: "H" } }],
      { charCount: 13, chunkCount: 1, indexVersion: fresh.indexVersion },
    );
    assert.equal(accepted?.status, "ready");
  });

  it("reindexing replaces a source's chunks rather than adding to them", async () => {
    const claimed = await sourceRepository.beginIndexing(fixture.a.sourceId, fixture.a.botId);
    assert.ok(claimed);

    await sourceRepository.replaceChunksAndMarkReady(
      fixture.a.sourceId,
      fixture.a.botId,
      [
        { content: "one", tokenCount: 1, embedding: unitVector(11), metadata: {} },
        { content: "two", tokenCount: 1, embedding: unitVector(12), metadata: {} },
      ],
      { charCount: 6, chunkCount: 2, indexVersion: claimed.indexVersion },
    );

    assert.equal(await chunkRepository.countBySource(fixture.a.sourceId), 2);
  });

  it("one idempotency key stores one turn, however many times it is sent", async () => {
    const conversation = await conversationRepository.create({
      botId: fixture.a.botId,
      channel: "app",
    });
    const requestId = "11111111-2222-3333-4444-555555555555";

    const first = await conversationRepository.appendTurn({
      conversationId: conversation.id,
      question: "What is the refund window?",
      assistant: {
        content: "Thirty days [1].",
        citations: [],
        requestId,
        answerStatus: "answered",
        credits: 1,
      },
    });
    assert.ok(first);

    const duplicate = await conversationRepository.appendTurn({
      conversationId: conversation.id,
      question: "What is the refund window?",
      assistant: { content: "Thirty days [1].", citations: [], requestId, answerStatus: "answered", credits: 1 },
    });
    assert.equal(duplicate, null, "the second write must lose the race");

    // The rejected write leaves no orphan question behind either.
    const messages = await conversationRepository.listMessages(conversation.id);
    assert.equal(messages.length, 2);

    const replayable = await conversationRepository.findTurnByRequestId(conversation.id, requestId);
    assert.equal(replayable?.id, first.id);
  });

  it("two charges at the credit boundary cannot both succeed", async () => {
    const periodStart = "2026-01-01";
    const limit = 5;

    await usageRepository.chargeCredits(fixture.a.accountId, periodStart, 4, limit);

    const [left, right] = await Promise.all([
      usageRepository.chargeCredits(fixture.a.accountId, periodStart, 1, limit),
      usageRepository.chargeCredits(fixture.a.accountId, periodStart, 1, limit),
    ]);

    const succeeded = [left, right].filter((result) => result !== null);
    assert.equal(succeeded.length, 1, "exactly one charge may cross the boundary");
    assert.equal((await usageRepository.find(fixture.a.accountId, periodStart))?.creditsUsed, limit);
  });

  it("editing the bot's voice drops the answers cached under the old one", async () => {
    await answerCacheRepository.put(fixture.a.botId, "hash-1", "what are your hours", "Nine to five [1].", []);
    assert.ok(await answerCacheRepository.get(fixture.a.botId, "hash-1"));

    await botService.update(fixture.a.botId, fixture.a.accountId, { tone: "concise" }, "free");

    assert.equal(await answerCacheRepository.get(fixture.a.botId, "hash-1"), null);
  });

  it("an edit that cannot change an answer leaves the cache alone", async () => {
    await answerCacheRepository.put(fixture.a.botId, "hash-2", "what are your hours", "Nine to five [1].", []);

    await botService.update(fixture.a.botId, fixture.a.accountId, { name: "Renamed" }, "free");

    assert.ok(await answerCacheRepository.get(fixture.a.botId, "hash-2"));
  });
});

describe("retry after a failure", { skip: hasDatabase ? false : "no DATABASE_URL" }, () => {
  let fixture: Fixture;

  before(async () => {
    fixture = await seedTwoTenants("retry");
  });

  after(async () => {
    await fixture?.cleanup();
  });

  it("a failed turn keeps no idempotency key, so Retry generates instead of replaying it", async () => {
    const conversation = await conversationRepository.create({
      botId: fixture.a.botId,
      channel: "app",
    });
    const requestId = "99999999-8888-7777-6666-555555555555";

    // What the turn service writes when the provider failed.
    const failed = await conversationRepository.appendTurn({
      conversationId: conversation.id,
      question: "What is the refund window?",
      assistant: { content: "", citations: [], requestId: null, answerStatus: "error", credits: 0 },
    });
    assert.ok(failed);
    assert.equal(await conversationRepository.findTurnByRequestId(conversation.id, requestId), null);

    // The retry succeeds and stores normally, key and all.
    const retried = await conversationRepository.appendTurn({
      conversationId: conversation.id,
      question: "What is the refund window?",
      assistant: { content: "Thirty days [1].", citations: [], requestId, answerStatus: "answered", credits: 1 },
    });
    assert.ok(retried);
    assert.equal((await conversationRepository.findTurnByRequestId(conversation.id, requestId))?.id, retried.id);
  });
});
