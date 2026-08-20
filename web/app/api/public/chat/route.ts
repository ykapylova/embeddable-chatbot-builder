import { z, ZodError } from "zod";

import type { ChatCitation, ChatStreamEvent } from "lib/api-types/chat";
import { planLimits } from "lib/plans";
import { botRepository } from "server/repositories/bot.repository";
import { conversationRepository } from "server/repositories/conversation.repository";
import { jsonErr } from "server/http/json-api";
import { getAnswerProvider, usedCitations, type AnswerHistoryMessage, type RetrievedChunk } from "server/services/answer";
import { corsHeaders, corsPreflight, withCors } from "server/services/widget/cors";
import {
  countConversationMessages,
  getAccountPlan,
  WIDGET_MAX_MESSAGES_PER_CONVERSATION,
  WIDGET_MESSAGE_MAX_LENGTH,
} from "server/services/widget/limits";
import { isHostAllowed, resolveRequestHost } from "server/services/widget/origin";
import { checkRateLimit } from "server/services/widget/rate-limit";
import { resolveRequestIp } from "server/services/widget/request-ip";
import { findRelevantChunksForTurn } from "server/services/retrieval.service";

export const runtime = "nodejs";

/** Same window as the owner-facing endpoint — see PROJECT_SPEC.md §8. */
const HISTORY_LIMIT = 4;

const chatTurnSchema = z.object({
  publicKey: z.string().trim().min(1, "publicKey is required"),
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Message is required").max(WIDGET_MESSAGE_MAX_LENGTH),
  visitorId: z.string().trim().min(1, "visitorId is required").max(128),
  pageUrl: z.string().trim().max(2048).optional(),
});

const encoder = new TextEncoder();

function err(request: Request, message: string, status: number, code?: string): Response {
  return withCors(request, jsonErr(message, status, code ? { code } : undefined));
}

function toChatCitations(citations: { index: number; sourceId: string; sourceTitle: string; sourceUrl: string | null }[]): ChatCitation[] {
  return citations.map((c) => ({
    index: c.index,
    sourceId: c.sourceId,
    sourceTitle: c.sourceTitle,
    sourceUrl: c.sourceUrl,
  }));
}

export function OPTIONS(request: Request): Response {
  return corsPreflight(request);
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err(request, "Invalid JSON body", 400);
  }

  let payload: z.infer<typeof chatTurnSchema>;
  try {
    payload = chatTurnSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return err(request, error.issues[0]?.message ?? "Invalid payload", 422);
    }
    throw error;
  }

  const bot = await botRepository.findByPublicKey(payload.publicKey);
  if (!bot) return err(request, "This assistant could not be found.", 404, "BOT_NOT_FOUND");
  if (bot.status !== "active") {
    return err(request, "This assistant is currently unavailable.", 403, "BOT_UNAVAILABLE");
  }

  const host = resolveRequestHost(request);
  if (!isHostAllowed(host, bot.allowedDomains)) {
    return err(
      request,
      "This site is not authorized to use this chat widget.",
      403,
      "DOMAIN_NOT_ALLOWED",
    );
  }

  const ip = resolveRequestIp(request);
  if (!checkRateLimit({ visitorId: payload.visitorId, ip, botId: bot.id })) {
    return err(request, "Too many messages — please wait a moment and try again.", 429, "RATE_LIMITED");
  }

  const conversation = payload.conversationId
    ? await conversationRepository.findOwned(payload.conversationId, bot.id)
    : await conversationRepository.create({
        botId: bot.id,
        channel: "widget",
        visitorId: payload.visitorId,
        pageUrl: payload.pageUrl,
      });

  // A conversation id from another visitor is treated as not found: the id is
  // an unguessable UUID, but a visitor who somehow obtained one must not be
  // able to read or extend someone else's transcript through this endpoint.
  if (!conversation || (conversation.visitorId && conversation.visitorId !== payload.visitorId)) {
    return err(request, "Conversation not found", 404);
  }

  const messageCount = await countConversationMessages(conversation.id);
  if (messageCount >= WIDGET_MAX_MESSAGES_PER_CONVERSATION) {
    return err(
      request,
      "This conversation has reached its message limit. Please start a new one.",
      403,
      "CONVERSATION_LIMIT",
    );
  }

  const historyRows = await conversationRepository.recentMessages(conversation.id, HISTORY_LIMIT);
  const history: AnswerHistoryMessage[] = historyRows.map((row) => ({
    role: row.role,
    content: row.content,
  }));

  // The quota check belongs here, before the model is ever called, so a
  // stream never dies mid-answer — but plan credits are not tracked yet
  // (T10). Model selection still respects the plan's allowed models.
  const plan = (await getAccountPlan(bot.accountId)) ?? "free";
  const model = planLimits(plan).models[0];
  const provider = getAnswerProvider();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let assistantText = "";
      let citations: ChatCitation[] = [];
      let keptCitations: ChatCitation[] | null = null;
      let answered = false;
      let usage = { tokens: 0, credits: 0 };
      let errored = false;
      let closed = false;

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
        const chunks: RetrievedChunk[] = await findRelevantChunksForTurn(bot.id, payload.message, history);

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
            keptCitations = usedCitations(assistantText, citations);
            send({ ...event, citations: keptCitations });
          } else {
            errored = true;
            send(event);
          }

          if (request.signal.aborted) break;
        }
      } catch (error) {
        console.error("[POST /api/public/chat]", error);
        errored = true;
        send({
          type: "error",
          code: "INTERNAL",
          message: "The assistant could not finish this answer. Please try again.",
        });
      } finally {
        request.signal.removeEventListener("abort", onAbort);

        // Same pairing rule as the owner endpoint: both messages are written
        // together, at the end, and only if something was actually said.
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
      ...corsHeaders(request),
    },
  });
}
