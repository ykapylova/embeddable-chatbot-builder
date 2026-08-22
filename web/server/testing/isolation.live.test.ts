import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { botRepository } from "server/repositories/bot.repository";
import { chunkRepository } from "server/repositories/chunk.repository";
import { conversationRepository } from "server/repositories/conversation.repository";
import { leadRepository } from "server/repositories/lead.repository";
import { sourceRepository } from "server/repositories/source.repository";

import { hasDatabase, seedTwoTenants, unitVector, type Fixture } from "./fixture";

/**
 * §9 of the reliability document: multi-tenant isolation. The code is correct
 * today — every resource loads through a `findOwned(id, ownerId)` and vector
 * search is unconditionally scoped by `bot_id`. What did not exist was anything
 * that would notice if that stopped being true.
 *
 * Skipped without `DATABASE_URL`; `npm run test:live` supplies one.
 */
describe("multi-tenant isolation", { skip: hasDatabase ? false : "no DATABASE_URL" }, () => {
  let fixture: Fixture;

  before(async () => {
    fixture = await seedTwoTenants("isolation");
  });

  after(async () => {
    await fixture?.cleanup();
  });

  it("vector search never crosses a bot boundary, even on an identical embedding", async () => {
    // Both tenants' chunks were stored with the same vector, so relevance
    // cannot be what separates them.
    const query = unitVector(7);

    const forA = await chunkRepository.findRelevant(fixture.a.botId, query, { limit: 10, minScore: 0 });
    const forB = await chunkRepository.findRelevant(fixture.b.botId, query, { limit: 10, minScore: 0 });

    assert.deepEqual(
      forA.map((row) => row.id),
      [fixture.a.chunkId],
    );
    assert.deepEqual(
      forB.map((row) => row.id),
      [fixture.b.chunkId],
    );
    assert.ok(!forA.some((row) => row.content.includes("BETA SECRET")));
  });

  it("a bot cannot be loaded with another account's id", async () => {
    assert.ok(await botRepository.findOwned(fixture.a.botId, fixture.a.accountId));
    assert.equal(await botRepository.findOwned(fixture.a.botId, fixture.b.accountId), null);
  });

  it("a source cannot be loaded — or mutated — through another bot", async () => {
    assert.ok(await sourceRepository.findOwned(fixture.a.sourceId, fixture.a.botId));
    assert.equal(await sourceRepository.findOwned(fixture.a.sourceId, fixture.b.botId), null);

    const stolen = await sourceRepository.update(fixture.a.sourceId, fixture.b.botId, {
      title: "renamed by the wrong tenant",
    });
    assert.equal(stolen, null);

    const untouched = await sourceRepository.findOwned(fixture.a.sourceId, fixture.a.botId);
    assert.equal(untouched?.title, "alpha handbook");
  });

  it("a conversation cannot be read through another bot", async () => {
    const conversation = await conversationRepository.create({
      botId: fixture.a.botId,
      channel: "widget",
      visitorId: "visitor-a",
    });

    assert.ok(await conversationRepository.findOwned(conversation.id, fixture.a.botId));
    assert.equal(await conversationRepository.findOwned(conversation.id, fixture.b.botId), null);
  });

  it("leads stay inside the bot that captured them", async () => {
    await leadRepository.create({
      botId: fixture.a.botId,
      conversationId: null,
      email: "lead@example.test",
    });

    const own = await leadRepository.listAllForExport(fixture.a.botId);
    const other = await leadRepository.listAllForExport(fixture.b.botId);

    assert.equal(own.length, 1);
    assert.equal(other.length, 0);
  });

  it("a deleted source's chunks are never retrieved again", async () => {
    const query = unitVector(7);
    assert.equal(
      (await chunkRepository.findRelevant(fixture.b.botId, query, { limit: 10, minScore: 0 })).length,
      1,
    );

    await sourceRepository.remove(fixture.b.sourceId, fixture.b.botId);

    assert.equal(
      (await chunkRepository.findRelevant(fixture.b.botId, query, { limit: 10, minScore: 0 })).length,
      0,
    );
    // And the other tenant is untouched by it.
    assert.equal(
      (await chunkRepository.findRelevant(fixture.a.botId, query, { limit: 10, minScore: 0 })).length,
      1,
    );
  });
});
