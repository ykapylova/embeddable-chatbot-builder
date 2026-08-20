import { count, eq } from "drizzle-orm";

import { getDb } from "server/db/client";
import { accountsTable, messagesTable } from "server/db/schema";
import type { PlanId } from "lib/plans";

/** Mirrors the owner-facing chat endpoint's cap — see `app/api/bots/[botId]/chat/route.ts`. */
export const WIDGET_MESSAGE_MAX_LENGTH = 4000;

/**
 * A cutoff after which a conversation must start over. Protects a single
 * bot from one runaway thread rather than gating spend directly — credit
 * quotas are T10's job.
 */
export const WIDGET_MAX_MESSAGES_PER_CONVERSATION = 60;

export async function countConversationMessages(conversationId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId));
  return Number(row?.value ?? 0);
}

/**
 * The chat route needs the owning account's plan to pick a model, but only
 * has the bot (resolved by public key, not by an authenticated account) — so
 * it cannot go through `requireAccount`. A direct, read-only lookup here
 * avoids reaching into `account.repository.ts`, which is outside this task's
 * territory.
 */
export async function getAccountPlan(accountId: string): Promise<PlanId | null> {
  const db = getDb();
  const [row] = await db
    .select({ plan: accountsTable.plan })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);
  return row?.plan ?? null;
}
