import type { RetrievalCandidate, RetrievedChunk } from "lib/api-types/retrieval";
import { chunkRepository, type RelevantChunkRow } from "server/repositories/chunk.repository";
import { ANSWER_BUDGET } from "server/services/answer/budget";
import { embedTexts } from "server/services/sources/embed.service";

const DEFAULT_LIMIT = ANSWER_BUDGET.contextChunks;

// Retrieval used to keep only chunks scoring above an absolute 0.35. Measured
// against real content that number sat inside the noise band: a wrong chunk
// reached 0.340 while a verbatim-correct one fell to 0.296, so no single
// threshold separated them. A fact that was literally in the knowledge base
// came back as "I don't know" purely because of how the question was phrased.
//
// The rule is relative now. The best hit is almost always the right chunk
// (nine of ten measured questions retrieved it at rank 1), so we keep it
// whenever it clears a low floor, then keep the runners-up only while they
// stay within a margin of that best hit. A genuinely unrelated question still
// scores below the floor everywhere and returns nothing — which is what lets
// the bot say "I don't know" instead of answering from a fragment.
export const SCORE_FLOOR = 0.22;
export const RELATIVE_MARGIN = 0.12;

/**
 * How many rows the debug panel looks at. Wider than the answer path on
 * purpose: its whole job is to show the near-misses the answer path discarded.
 */
const DEBUG_CANDIDATE_LIMIT = 10;

/**
 * Keeps the best hit and everything scoring within `margin` of it. Rows must
 * already be ordered by score descending. Pure and side-effect free so the
 * selection rule can be tested without a database or an embedding call.
 */
export function selectByMargin<T extends { score: number }>(rows: T[], margin: number): T[] {
  if (rows.length === 0) return [];
  const best = rows[0].score;
  return rows.filter((row) => row.score >= best - margin);
}

function toRetrievedChunk(row: RelevantChunkRow): RetrievedChunk {
  return {
    id: row.id,
    sourceId: row.sourceId,
    sourceTitle: row.sourceTitle,
    sourceUrl: row.sourceUrl,
    content: row.content,
    score: row.score,
  };
}

/**
 * Embeds the question and returns the closest chunks for one bot, ordered
 * by score descending. Always scoped by `bot_id` — this is the query a
 * chat answer and the debug panel both go through, and neither may see
 * another bot's knowledge.
 *
 * The floor is applied in the query; the relative margin is applied here.
 * A wider candidate window than `limit` is fetched so the margin can see the
 * runners-up before the cap, then the surviving set is trimmed to `limit`.
 */
export async function findRelevantChunks(
  botId: string,
  question: string,
  limit: number = DEFAULT_LIMIT,
): Promise<RetrievedChunk[]> {
  const trimmed = question.trim();
  if (!trimmed) return [];

  const [embedding] = await embedTexts([trimmed]);
  const candidates = await chunkRepository.findRelevant(botId, embedding, {
    limit: Math.max(limit, DEFAULT_LIMIT),
    minScore: SCORE_FLOOR,
  });

  return selectByMargin(candidates, RELATIVE_MARGIN).slice(0, limit).map(toRetrievedChunk);
}

/**
 * The same selection, but reporting what it threw away and why.
 *
 * The answer path applies the floor inside the query, so a chunk that scored
 * 0.19 never comes back at all — which made the one screen built to explain
 * retrieval unable to tell "found, but below the floor" apart from "nothing in
 * the knowledge base". This runs the identical rule over an unfiltered
 * candidate list and labels each row instead of dropping it.
 */
export async function inspectRetrieval(
  botId: string,
  question: string,
  limit: number = DEFAULT_LIMIT,
): Promise<RetrievalCandidate[]> {
  const trimmed = question.trim();
  if (!trimmed) return [];

  const [embedding] = await embedTexts([trimmed]);
  const candidates = await chunkRepository.findRelevant(botId, embedding, {
    limit: DEBUG_CANDIDATE_LIMIT,
    minScore: 0,
  });

  const aboveFloor = candidates.filter((row) => row.score >= SCORE_FLOOR);
  const withinMargin = selectByMargin(aboveFloor, RELATIVE_MARGIN);
  const keptIds = new Set(withinMargin.slice(0, limit).map((row) => row.id));
  const withinMarginIds = new Set(withinMargin.map((row) => row.id));

  return candidates.map((row) => {
    const chunk = toRetrievedChunk(row);
    if (keptIds.has(row.id)) return { ...chunk, kept: true, rejectedBecause: null };
    if (row.score < SCORE_FLOOR) return { ...chunk, kept: false, rejectedBecause: "below_floor" };
    if (!withinMarginIds.has(row.id)) {
      return { ...chunk, kept: false, rejectedBecause: "outside_margin" };
    }
    return { ...chunk, kept: false, rejectedBecause: "over_limit" };
  });
}

type TurnMessage = { role: "user" | "assistant"; content: string };

/**
 * Retrieval for a message inside a conversation.
 *
 * "How long do I have?" carries almost no meaning on its own, so embedding it
 * alone returns nothing and the bot claims not to know something it just said.
 * The second pass prepends the previous question, which is what the visitor
 * would have written had they not been mid-conversation.
 *
 * It runs only when the first pass found nothing, so a self-contained question
 * costs exactly one embedding and can never be diluted by an unrelated earlier
 * turn.
 */
export async function findRelevantChunksForTurn(
  botId: string,
  question: string,
  history: TurnMessage[],
  limit: number = DEFAULT_LIMIT,
): Promise<RetrievedChunk[]> {
  const direct = await findRelevantChunks(botId, question, limit);
  if (direct.length > 0) return direct;

  const previousQuestion = history.findLast((message) => message.role === "user")?.content;
  if (!previousQuestion) return direct;

  return findRelevantChunks(botId, `${previousQuestion}\n${question}`, limit);
}
