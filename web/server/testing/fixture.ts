import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "server/db/client";
import { accountsTable, botsTable, chunksTable, sourcesTable } from "server/db/schema";
import { env } from "server/env";

/**
 * The two-accounts / two-bots / two-sources fixture the reliability document's
 * §9 asks for, against the real database.
 *
 * These tests are the only thing standing between a careless refactor and the
 * worst bug this product can have — one customer's documentation answering
 * another customer's visitor. Everything else in the suite is a pure function
 * over in-memory data, which cannot notice a missing `WHERE bot_id`.
 *
 * They need a database, so `npm test` skips them and `npm run test:live` runs
 * them. Skipping loudly is deliberate: a silent pass would be worse than no
 * test at all.
 */
export const hasDatabase = Boolean(env.databaseUrl);

export const EMBEDDING_DIMENSIONS = 1536;

/**
 * A deterministic unit vector, so similarity is a fact of the test rather than
 * of an API call. `seed` 0 and 1 are orthogonal; the same seed twice is the
 * same vector, which is what lets one query match two different bots' chunks
 * equally well — exactly the case isolation has to survive.
 */
export function unitVector(seed: number): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  vector[seed % EMBEDDING_DIMENSIONS] = 1;
  return vector;
}

export type Tenant = {
  accountId: string;
  botId: string;
  sourceId: string;
  chunkId: string;
};

export type Fixture = {
  a: Tenant;
  b: Tenant;
  cleanup: () => Promise<void>;
};

/**
 * Two independent accounts, each with a bot, a source and one chunk whose
 * embedding is *identical* to the other tenant's. Nothing about relevance can
 * separate them — only the `WHERE bot_id` can.
 */
export async function seedTwoTenants(label: string): Promise<Fixture> {
  const db = getDb();
  const accountIds: string[] = [];

  async function seedTenant(suffix: string, embedding: number[]): Promise<Tenant> {
    const [account] = await db
      .insert(accountsTable)
      .values({
        clerkUserId: `test_${label}_${suffix}_${randomUUID()}`,
        email: `${label}-${suffix}@example.test`,
      })
      .returning();
    accountIds.push(account.id);

    const [bot] = await db
      .insert(botsTable)
      .values({
        accountId: account.id,
        name: `${label} ${suffix}`,
        publicKey: `pk_test_${randomUUID().replace(/-/g, "")}`,
        welcomeMessage: "Hi",
        fallbackMessage: "I don't know.",
      })
      .returning();

    const [source] = await db
      .insert(sourcesTable)
      .values({ botId: bot.id, type: "text", title: `${suffix} handbook`, status: "ready" })
      .returning();

    const [chunk] = await db
      .insert(chunksTable)
      .values({
        sourceId: source.id,
        botId: bot.id,
        chunkIndex: 0,
        content: `${suffix.toUpperCase()} SECRET: the refund window is ${suffix.length} days.`,
        tokenCount: 12,
        embedding,
      })
      .returning();

    return { accountId: account.id, botId: bot.id, sourceId: source.id, chunkId: chunk.id };
  }

  // The same vector on purpose: if isolation ever breaks, this is the query
  // that notices.
  const shared = unitVector(7);
  const a = await seedTenant("alpha", shared);
  const b = await seedTenant("beta", shared);

  return {
    a,
    b,
    cleanup: async () => {
      // Accounts cascade to bots, sources, chunks, conversations and leads.
      await db.delete(accountsTable).where(inArray(accountsTable.id, accountIds));
    },
  };
}

/** Drops one account and everything under it — used by tests that seed their own. */
export async function deleteAccount(accountId: string): Promise<void> {
  await getDb().delete(accountsTable).where(eq(accountsTable.id, accountId));
}
