import { getDb } from "server/db/client";
import { processedStripeEventsTable } from "server/db/schema";

/** Accepts either the pooled client or a transaction, so webhook handlers can stay atomic. */
type QueryExecutor = Pick<ReturnType<typeof getDb>, "insert">;

export const stripeEventRepository = {
  /**
   * Inserted before the event is handled, per PROJECT_SPEC.md §10.7. Returns
   * `false` when `eventId` already exists — a redelivery the caller must skip.
   */
  async markProcessed(eventId: string, type: string, executor: QueryExecutor = getDb()): Promise<boolean> {
    const [row] = await executor
      .insert(processedStripeEventsTable)
      .values({ eventId, type })
      .onConflictDoNothing({ target: processedStripeEventsTable.eventId })
      .returning();
    return Boolean(row);
  },
};
