import type { ChatCitation, ChatStreamEvent } from "lib/api-types/chat";
import type { ModelId, PlanId } from "lib/plans";
import { logEvent, logFailure } from "server/observability/log";
import { conversationRepository, type MessageRow } from "server/repositories/conversation.repository";
import {
  getAnswerProvider,
  usedCitations,
  type AnswerHistoryMessage,
  type RetrievedChunk,
} from "server/services/answer";
import { lookupCachedAnswer, storeCachedAnswer } from "server/services/answer/cache";
import { CREDIT_LIMIT_MESSAGE, chargeForAnswer, refundForAnswer } from "server/services/plan.service";
import { findRelevantChunksForTurn } from "server/services/retrieval.service";
import type { StoredAnswerStatus } from "server/services/chat/answer-status";

export type ChatTurnInput = {
  /** Which endpoint this turn came through — the log's only way to tell them apart. */
  channel: "app" | "widget";
  requestId: string;
  accountId: string;
  plan: PlanId;
  model: ModelId;
  botId: string;
  botInstruction: string | null;
  tone: string;
  fallbackMessage: string;
  conversationId: string;
  question: string;
  history: AnswerHistoryMessage[];
  signal: AbortSignal;
};

const encoder = new TextEncoder();

/** Outcomes worth replaying: the turn finished, whatever it finished as. */
const CONCLUDED_STATUSES: readonly StoredAnswerStatus[] = [
  "answered",
  "abstained",
  "no_context",
  "quota",
];

function toChatCitations(
  citations: { index: number; sourceId: string; sourceTitle: string; sourceUrl: string | null }[],
): ChatCitation[] {
  return citations.map((c) => ({
    index: c.index,
    sourceId: c.sourceId,
    sourceTitle: c.sourceTitle,
    sourceUrl: c.sourceUrl,
  }));
}

/** Citations come back from jsonb as `unknown`; only well-formed entries survive. */
function readStoredCitations(raw: unknown): ChatCitation[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { index, sourceId, sourceTitle, sourceUrl } = entry as Record<string, unknown>;
    if (typeof index !== "number" || typeof sourceId !== "string" || typeof sourceTitle !== "string") {
      return [];
    }
    return [{ index, sourceId, sourceTitle, sourceUrl: typeof sourceUrl === "string" ? sourceUrl : null }];
  });
}

function sse(controller: ReadableStreamDefaultController<Uint8Array>, event: ChatStreamEvent): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

/**
 * Replays a turn that was already generated for this `requestId` instead of
 * generating — and charging for — it a second time. This is what makes the
 * chat surface's Retry button safe after a stream that died once the model had
 * already run.
 */
export function replayStoredTurn(conversationId: string, stored: MessageRow): ReadableStream<Uint8Array> {
  const citations = readStoredCitations(stored.citations);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      sse(controller, { type: "start", conversationId, citations });
      if (stored.content) sse(controller, { type: "delta", text: stored.content });
      sse(controller, {
        type: "done",
        answered: stored.answerStatus === "answered",
        usage: { tokens: 0, credits: 0 },
        citations,
      });
      controller.close();
    },
  });
}

/**
 * One chat turn, from cache lookup to the pair of stored messages. Both chat
 * endpoints run this: they differ in how the caller is authenticated and in
 * nothing else, and when the logic lived in each route the two drifted.
 */
export function streamChatTurn(input: ChatTurnInput): ReadableStream<Uint8Array> {
  const provider = getAnswerProvider();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let assistantText = "";
      let citations: ChatCitation[] = [];
      let keptCitations: ChatCitation[] | null = null;
      let answered = false;
      let status: StoredAnswerStatus = "error";
      let usage = { tokens: 0, inputTokens: 0, outputTokens: 0, credits: 0 };
      let cacheHit = false;
      let retrievalCount: number | null = null;
      let topScore: number | null = null;
      let retrievalMs: number | null = null;
      let firstTokenMs: number | null = null;
      let closed = false;
      let charged = false;

      const send = (event: ChatStreamEvent) => {
        if (closed) return;
        try {
          sse(controller, event);
        } catch {
          closed = true;
        }
      };

      const onAbort = () => {
        closed = true;
      };
      input.signal.addEventListener("abort", onAbort);

      try {
        // A repeated standalone question is answered from the cache with no
        // retrieval and no model call. The turn is still persisted below, at
        // zero credits — the win is latency, not money.
        const cached = await lookupCachedAnswer(input.botId, input.question, input.history);
        if (cached) {
          cacheHit = true;
          keptCitations = cached.citations;
          send({ type: "start", conversationId: input.conversationId, citations: cached.citations });
          assistantText = cached.answer;
          firstTokenMs = Date.now() - startedAt;
          send({ type: "delta", text: cached.answer });
          answered = true;
          status = "answered";
          send({
            type: "done",
            answered: true,
            usage: { tokens: 0, credits: 0 },
            citations: cached.citations,
          });
          return;
        }

        const retrievalStartedAt = Date.now();
        const chunks: RetrievedChunk[] = await findRelevantChunksForTurn(
          input.botId,
          input.question,
          input.history,
        );
        retrievalMs = Date.now() - retrievalStartedAt;
        retrievalCount = chunks.length;
        topScore = chunks[0]?.score ?? null;

        // Retrieval already tells us whether this turn will call the model at
        // all — an empty result is always a free, canned fallback (see the
        // answer provider). Only a real model call needs a credit, so the
        // atomic charge happens here, before the model is ever invoked: a
        // stream must not die mid-answer because a plan limit was hit.
        const willCost = chunks.length > 0;
        if (willCost) {
          charged = await chargeForAnswer(input.accountId, input.plan, input.model);
        }

        if (willCost && !charged) {
          // Free: this *is* the placeholder. Pro/Business: the 10% grace buffer
          // (applied inside chargeForAnswer) has also run out — same
          // contact-collection behaviour either way. The widget must never go
          // silent (PROJECT_SPEC.md §10.4).
          send({ type: "start", conversationId: input.conversationId, citations: [] });
          assistantText = CREDIT_LIMIT_MESSAGE;
          firstTokenMs = Date.now() - startedAt;
          send({ type: "delta", text: assistantText });
          keptCitations = [];
          status = "quota";
          send({ type: "done", answered: false, usage: { tokens: 0, credits: 0 }, citations: [] });
        } else {
          for await (const event of provider.answer({
            question: input.question,
            history: input.history,
            chunks,
            model: input.model,
            botInstruction: input.botInstruction,
            tone: input.tone,
            fallbackMessage: input.fallbackMessage,
            signal: input.signal,
          })) {
            if (input.signal.aborted) break;

            if (event.type === "start") {
              citations = toChatCitations(event.citations);
              send({ type: "start", conversationId: input.conversationId, citations });
            } else if (event.type === "delta") {
              if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
              assistantText += event.text;
              send(event);
            } else if (event.type === "done") {
              answered = event.answered;
              status = event.status;
              usage = event.usage;
              // The client showed every retrieved source while the answer was
              // still streaming; now that the text is complete, tell it which
              // ones the answer actually leaned on. Same list that gets stored,
              // so the playground and the transcript cannot disagree.
              keptCitations = usedCitations(assistantText, citations);
              send({
                type: "done",
                answered: event.answered,
                usage: { tokens: usage.tokens, credits: usage.credits },
                citations: keptCitations,
              });
            } else {
              status = "error";
              send(event);
            }

            if (input.signal.aborted) break;
          }

          // A turn the visitor walked away from never reached `done`.
          if (input.signal.aborted && status !== "error") status = "aborted";

          // Cache only a grounded, completed answer, so the next visitor asking
          // the same question skips retrieval and the model entirely.
          if (answered && keptCitations && keptCitations.length > 0) {
            await storeCachedAnswer(
              input.botId,
              input.question,
              input.history,
              assistantText,
              keptCitations,
            );
          }
        }
      } catch (error) {
        logFailure("chat.turn.failed", error, {
          requestId: input.requestId,
          botId: input.botId,
          conversationId: input.conversationId,
        });
        status = "error";
        send({
          type: "error",
          code: "INTERNAL",
          message: "The assistant could not finish this answer. Please try again.",
        });
      } finally {
        input.signal.removeEventListener("abort", onAbort);

        // A charge that never turned into a delivered answer (an error, the
        // visitor disconnecting mid-stream, or the model declining to answer
        // from weak context) costs the customer nothing.
        if (charged && !answered) {
          await refundForAnswer(input.accountId, input.model);
        }

        const latencyMs = Date.now() - startedAt;

        // Both messages are written here, at the end, and only as a pair.
        // Storing the question up front looked safer but left a question with
        // no answer whenever the visitor stopped the turn before the first
        // token — and since Retry resends the same text, the transcript then
        // showed them asking twice. A turn that produced nothing at all leaves
        // nothing behind; a half-written answer is still kept, because that is
        // data the visitor saw.
        if (assistantText || answered || status === "error") {
          const written = await conversationRepository.appendTurn({
            conversationId: input.conversationId,
            question: input.question,
            assistant: {
              content: assistantText,
              citations: keptCitations ?? usedCitations(assistantText, citations),
              // Only a turn that reached a conclusion keeps its idempotency
              // key. A turn that errored or was abandoned was refunded, so
              // Retry must generate a real answer rather than replay the
              // failure — and holding the key would also make that retry's own
              // write lose the unique index and vanish.
              requestId: CONCLUDED_STATUSES.includes(status) ? input.requestId : null,
              answerStatus: status,
              model: input.model,
              credits: usage.credits,
              tokens: usage.tokens || null,
              inputTokens: usage.inputTokens || null,
              outputTokens: usage.outputTokens || null,
              cacheHit,
              retrievalCount,
              topScore,
              retrievalMs,
              firstTokenMs,
              latencyMs,
            },
          });

          // Lost the race against a concurrent request carrying the same
          // idempotency key: the other turn is the one that counts, so this
          // one leaves nothing behind and gives its credit back.
          if (!written && charged && answered) {
            await refundForAnswer(input.accountId, input.model);
          }
        }

        logEvent("chat.turn", {
          requestId: input.requestId,
          channel: input.channel,
          botId: input.botId,
          conversationId: input.conversationId,
          status,
          cacheHit,
          retrievalCount,
          topScore,
          retrievalMs,
          firstTokenMs,
          latencyMs,
          model: input.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          credits: answered ? usage.credits : 0,
        });

        try {
          controller.close();
        } catch {
          // already closed by an aborted client
        }
      }
    },
  });
}
