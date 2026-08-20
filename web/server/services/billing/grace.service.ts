import { getDb } from "server/db/client";
import { accountRepository } from "server/repositories/account.repository";
import { subscriptionRepository } from "server/repositories/subscription.repository";

/**
 * The compromise PROJECT_SPEC.md §10.8 #10 takes instead of the source
 * document's "past_due grants access indefinitely" bug: a failed payment
 * keeps access for 7 days (set by the `invoice.payment_failed` webhook), then
 * this sweep drops the account to Free. Data is never deleted. Runs daily —
 * see `vercel.json` — since nothing else re-evaluates `grace_until` once it
 * is set.
 */
export async function sweepExpiredGrace(now: Date = new Date()): Promise<number> {
  const db = getDb();
  const expired = await subscriptionRepository.findExpiredGrace(now);

  for (const row of expired) {
    await db.transaction(async (tx) => {
      await subscriptionRepository.upsert(
        row.accountId,
        { plan: "free", paymentFailed: false, graceUntil: null },
        tx,
      );
      await accountRepository.updatePlan(row.accountId, "free", tx);
    });
  }

  return expired.length;
}
