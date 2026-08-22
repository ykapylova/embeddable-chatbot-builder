import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { sql } from "drizzle-orm";

import { getDb } from "server/db/client";
import { widgetRateLimitsTable } from "server/db/schema";
import { createPostgresStore } from "server/services/widget/rate-limit-store";

import { hasDatabase, seedTwoTenants, type Fixture } from "./fixture";

/**
 * §10 of the reliability document: the widget's limits have to hold across
 * instances, not per instance.
 *
 * Two stores are constructed here on purpose. They stand in for two warm
 * lambdas serving the same bot — the exact case a module-level `Map` cannot
 * cover, and the reason these counters live in Postgres. `rate-limit.test.ts`
 * covers the policy itself; this file covers only the sharing.
 *
 * Skipped without `DATABASE_URL`; `npm run test:live` supplies one.
 */
describe("shared widget limits", { skip: hasDatabase ? false : "no DATABASE_URL" }, () => {
  const instanceA = createPostgresStore();
  const instanceB = createPostgresStore();
  const run = randomUUID();
  const WINDOW_MS = 60_000;
  let fixture: Fixture;

  /** Every case gets its own keys, so one test's traffic never lands in another's counters. */
  const dimensions = (
    scope: string,
    visitor: string,
    ip: string,
    limits: [number, number, number],
  ) =>
    [
      { key: `live:${run}:${scope}:visitor:${visitor}`, limit: limits[0] },
      { key: `live:${run}:${scope}:ip:${ip}`, limit: limits[1] },
      { key: `live:${run}:${scope}:bot`, limit: limits[2] },
    ] as [
      { key: string; limit: number },
      { key: string; limit: number },
      { key: string; limit: number },
    ];

  before(async () => {
    fixture = await seedTwoTenants("ratelimit");
  });

  after(async () => {
    await getDb().execute(
      sql`DELETE FROM ${widgetRateLimitsTable} WHERE key LIKE ${`live:${run}:%`}`,
    );
    await fixture?.cleanup();
  });

  it("counts one visitor's requests once, whichever instance serves them", async () => {
    const spend = (store: typeof instanceA) => store.consume(dimensions("shared", "v1", "10.0.0.1", [4, 50, 500]), WINDOW_MS);

    assert.equal(await spend(instanceA), null, "first request");
    assert.equal(await spend(instanceB), null, "second request, other instance");
    assert.equal(await spend(instanceA), null, "third request");
    assert.equal(await spend(instanceB), null, "fourth request — the last one allowed");

    // Per-instance counters would have both stores at two of four here and let
    // this through. Sharing the row is what makes the limit mean four.
    assert.equal(await spend(instanceA), 0, "the fifth request trips the visitor dimension");
  });

  it("stops a refused request from consuming the bot's own budget", async () => {
    const attacker = dimensions("gate", "flooder", "10.0.0.2", [2, 500, 6]);
    for (let i = 0; i < 20; i++) await instanceA.consume(attacker, WINDOW_MS);

    const bystander = dimensions("gate", "bystander", "10.0.0.3", [2, 500, 6]);
    assert.equal(
      await instanceB.consume(bystander, WINDOW_MS),
      null,
      "a different visitor must still be served",
    );
  });

  it("caps concurrent generations across instances, and hands slots back", async () => {
    const botId = fixture.a.botId;
    const first = await instanceA.reserve(botId, 2, 60_000);
    const second = await instanceA.reserve(botId, 2, 60_000);
    assert.ok(first);
    assert.ok(second);

    assert.equal(await instanceB.reserve(botId, 2, 60_000), null, "the bot is full");
    // Another bot is unaffected: the cap is per bot, not global.
    const otherBot = await instanceB.reserve(fixture.b.botId, 2, 60_000);
    assert.ok(otherBot);
    await instanceB.release(otherBot);

    await instanceA.release(first);
    const reclaimed = await instanceB.reserve(botId, 2, 60_000);
    assert.ok(reclaimed, "the freed slot is visible to the other instance");

    // A late release from the route that used to hold the slot must not free
    // the generation now running in it.
    await instanceA.release(first);
    assert.equal(await instanceB.reserve(botId, 2, 60_000), null);

    await instanceB.release(reclaimed);
    await instanceA.release(second);
  });

  it("reclaims a slot whose route died without releasing it", async () => {
    const botId = fixture.b.botId;
    const leaked = await instanceA.reserve(botId, 1, -1_000);
    assert.ok(leaked, "a slot that is already past its TTL is still handed out");

    const reclaimed = await instanceB.reserve(botId, 1, 60_000);
    assert.ok(reclaimed, "an expired slot is reusable without any cleanup step");
    await instanceB.release(reclaimed);
  });
});
