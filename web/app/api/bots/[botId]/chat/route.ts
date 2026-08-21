import { z, ZodError } from "zod";

import type { ChatCitation, ChatStreamEvent } from "lib/api-types/chat";
import { planLimits } from "lib/plans";
import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr } from "server/http/json-api";
import { botRepository } from "server/repositories/bot.repository";
import { conversationRepository } from "server/repositories/conversation.repository";
import { getAnswerProvider, usedCitations, type AnswerHistoryMessage, type RetrievedChunk } from "server/services/answer";
import { lookupCachedAnswer, storeCachedAnswer } from "server/services/answer/cache";
import { CREDIT_LIMIT_MESSAGE, chargeForAnswer, refundForAnswer } from "server/services/plan.service";
import { findRelevantChunksForTurn } from "server/services/retrieval.service";

export const runtime = "nodejs";

/** Only the last 4 turns go into the prompt — see PROJECT_SPEC.md §8. */
const HISTORY_LIMIT = 4;

type RouteContext = { params: Promise<{ botId: string }> };

const chatTurnSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Message is required").max(4000),
});

const encoder = new TextEncoder();

function toChatCitations(citations: { index: number; sourceId: string; sourceTitle: string; sourceUrl: string | null }[]): ChatCitation[] {
  return citations.map((c) => ({
    index: c.index,
    sourceId: c.sourceId,
    sourceTitle: c.sourceTitle,
    sourceUrl: c.sourceUrl,
  }));
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;
  const { account } = result;

  const { botId } = await context.params;
  const bot = await botRepository.findOwned(botId, account.id);
  if (!bot) return jsonErr("Bot not found", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  let payload: z.infer<typeof chatTurnSchema>;
  try {
    payload = chatTurnSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonErr(error.issues[0]?.message ?? "Invalid payload", 422);
    }
    throw error;
  }

  const conversation = payload.conversationId
    ? await conversationRepository.findOwned(payload.conversationId, botId)
    : await conversationRepository.create({ botId, channel: "app" });

  if (!conversation) return jsonErr("Conversation not found", 404);

  const historyRows = await conversationRepository.recentMessages(conversation.id, HISTORY_LIMIT);
  const history: AnswerHistoryMessage[] = historyRows.map((row) => ({
    role: row.role,
    content: row.content,
  }));

  const model = planLimits(account.plan).models[0];
  const provider = getAnswerProvider();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let assistantText = "";
      let citations: ChatCitation[] = [];
      let keptCitations: ChatCitation[] | null = null;
      let answered = false;
      let usage = { tokens: 0, credits: 0 };
      let errored: { code: string; message: string } | null = null;
      let closed = false;
      let charged = false;

      const send = (event: ChatStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const onAbort = () => {
        closed = true;
      };
      request.signal.addEventListener("abort", onAbort);

      try {
        // A repeated standalone question is answered from the cache with no
        // retrieval and no model call. The finally block still persists the
        // turn, at zero credits — the win is latency, not money.
        const cached = await lookupCachedAnswer(botId, payload.message, history);
        if (cached) {
          keptCitations = cached.citations;
          send({ type: "start", conversationId: conversation.id, citations: cached.citations });
          assistantText = cached.answer;
          send({ type: "delta", text: cached.answer });
          answered = true;
          usage = { tokens: 0, credits: 0 };
          send({ type: "done", answered: true, usage, citations: cached.citations });
          return;
        }

        const chunks: RetrievedChunk[] = await findRelevantChunksForTurn(
          botId,
          payload.message,
          history,
        );

        // Retrieval already tells us whether this turn will call the model at
        // all — an empty result is always a free, canned fallback (see the
        // answer provider). Only a real model call needs a credit, so the
        // atomic charge happens here, before the model is ever invoked: a
        // stream must not die mid-answer because a plan limit was hit.
        const willCost = chunks.length > 0;
        if (willCost) {
          charged = await chargeForAnswer(account.id, account.plan, model);
        }

        if (willCost && !charged) {
          send({ type: "start", conversationId: conversation.id, citations: [] });
          assistantText = CREDIT_LIMIT_MESSAGE;
          send({ type: "delta", text: assistantText });
          usage = { tokens: 0, credits: 0 };
          keptCitations = [];
          send({ type: "done", answered: false, usage, citations: [] });
        } else {
          for await (const event of provider.answer({
            question: payload.message,
            history,
            chunks,
            model,
            botInstruction: bot.systemPrompt,
            tone: bot.tone,
            fallbackMessage: bot.fallbackMessage,
          })) {
            if (request.signal.aborted) break;

            if (event.type === "start") {
              citations = toChatCitations(event.citations);
              send({ type: "start", conversationId: conversation.id, citations });
            } else if (event.type === "delta") {
              assistantText += event.text;
              send(event);
            } else if (event.type === "done") {
              answered = event.answered;
              usage = event.usage;
              // The client showed every retrieved source while the answer was
              // still streaming; now that the text is complete, tell it which
              // ones the answer actually leaned on. Same list that gets stored,
              // so the playground and the transcript cannot disagree.
              keptCitations = usedCitations(assistantText, citations);
              send({ ...event, citations: keptCitations });
            } else {
              errored = { code: event.code, message: event.message };
              send(event);
            }

            if (request.signal.aborted) break;
          }

          // Cache only a grounded, completed answer, so the next visitor asking
          // the same question skips retrieval and the model entirely.
          if (answered && keptCitations && keptCitations.length > 0) {
            await storeCachedAnswer(botId, payload.message, history, assistantText, keptCitations);
          }
        }
      } catch (error) {
        console.error("[POST /api/bots/:botId/chat]", error);
        errored = { code: "INTERNAL", message: "The assistant could not finish this answer. Please try again." };
        send({ type: "error", ...errored });
      } finally {
        request.signal.removeEventListener("abort", onAbort);

        // A charge that never turned into a delivered answer (an error, or the
        // visitor disconnecting mid-stream) costs the customer nothing.
        if (charged && !answered) {
          await refundForAnswer(account.id, model);
        }

        // Both messages are written here, at the end, and only as a pair.
        // Storing the question up front looked safer but left a question with
        // no answer whenever the visitor stopped the turn before the first
        // token — and since Retry resends the same text, the transcript then
        // showed them asking twice. A turn that produced nothing at all leaves
        // nothing behind; a half-written answer is still kept, because that is
        // data the visitor saw.
        if (assistantText || answered || errored) {
          await conversationRepository.appendMessage({
            conversationId: conversation.id,
            role: "user",
            content: payload.message,
          });

          await conversationRepository.appendMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: assistantText,
            citations: keptCitations ?? usedCitations(assistantText, citations),
            model,
            credits: usage.credits,
            tokens: usage.tokens || null,
            latencyMs: Date.now() - startedAt,
          });
        }

        try {
          controller.close();
        } catch {
          // already closed by an aborted client
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
