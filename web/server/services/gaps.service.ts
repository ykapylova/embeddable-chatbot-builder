import type { GapItem, GapsResponse } from "lib/api-types/gaps";
import { planLimits, type PlanId } from "lib/plans";
import { botRepository } from "server/repositories/bot.repository";
import { gapRepository } from "server/repositories/gap.repository";

/** Groups near-duplicate questions without embeddings: lowercase, strip
 * punctuation, collapse whitespace. Good enough to merge "Do you ship to
 * Canada?" and "do you ship to canada" without merging unrelated questions. */
function normalize(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

export const gapsService = {
  /**
   * Free sees only the count — a teaser, not a wall (PROJECT_SPEC.md §10.3).
   * Grouping happens in-process: the failure list is already bounded by
   * `gapRepository`'s row cap, so this never scans an unbounded set.
   */
  async list(botId: string, accountId: string, plan: PlanId): Promise<GapsResponse | null> {
    const bot = await botRepository.findOwned(botId, accountId);
    if (!bot) return null;

    const failures = await gapRepository.listFailures(botId);

    const groups = new Map<string, GapItem>();
    for (const failure of failures) {
      const question = failure.question?.trim();
      if (!question) continue;
      const key = normalize(question);
      if (!key) continue;

      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        // Rows arrive newest-first, so the first one seen per key is also the
        // most recent phrasing — used as the canonical display text.
        groups.set(key, {
          key,
          question,
          count: 1,
          lastAskedAt: failure.createdAt,
          sampleConversationId: failure.conversationId,
        });
      }
    }

    const items = [...groups.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastAskedAt.localeCompare(a.lastAskedAt);
    });

    if (planLimits(plan).gaps === "counter") {
      return { gated: true, count: items.length };
    }

    return { gated: false, count: items.length, items };
  },
};
