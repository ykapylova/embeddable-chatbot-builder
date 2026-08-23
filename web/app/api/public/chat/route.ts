import { randomUUID } from "node:crypto";

import { z, ZodError } from "zod";

import { planLimits } from "lib/plans";
import { env } from "server/env";
import { logRefusal } from "server/observability/log";
import { botRepository } from "server/repositories/bot.repository";
import { conversationRepository } from "server/repositories/conversation.repository";
import { jsonErr } from "server/http/json-api";
import { ANSWER_BUDGET, type AnswerHistoryMessage } from "server/services/answer";
import { replayStoredTurn, streamChatTurn } from "server/services/chat/turn.service";
import { corsHeaders, corsPreflight, withCors } from "server/services/widget/cors";
import {
  countConversationMessages,
  getAccountPlan,
  WIDGET_MAX_MESSAGES_PER_CONVERSATION,
  WIDGET_MESSAGE_MAX_LENGTH,
} from "server/services/widget/limits";
import { isSelfOriginated, resolveRequestHost } from "server/services/widget/origin";
import {
  checkRateLimit,
  releaseGeneration,
  releaseGenerationSlot,
  reserveGeneration,
} from "server/services/widget/rate-limit";
import { resolveRequestIp } from "server/services/widget/request-ip";

export const runtime = "nodejs";

const chatTurnSchema = z.object({
  publicKey: z.string().trim().min(1, "publicKey is required"),
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Message is required").max(WIDGET_MESSAGE_MAX_LENGTH),
  visitorId: z.string().trim().min(1, "visitorId is required").max(128),
  pageUrl: z.string().trim().max(2048).optional(),
  /** See the owner-facing endpoint: stable across the widget's own Retry. */
  requestId: z.string().uuid().optional(),
});

function err(request: Request, message: string, status: number, code?: string): Response {
  return withCors(request, jsonErr(message, status, code ? { code } : undefined));
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

  // The bot's allowed domains are enforced on the iframe's own navigation, in
  // app/embed/[publicKey]/page.tsx — this call is same-origin from inside that
  // iframe, so its Origin says nothing about the site the visitor is on. What
  // is still worth asking here is whether the caller is that iframe at all.
  if (!isSelfOriginated(request, env.appUrl)) {
    logRefusal("widget.blocked", {
      code: "FOREIGN_ORIGIN",
      botId: bot.id,
      route: "chat",
      host: resolveRequestHost(request),
    });
    return err(request, "This request did not come from the chat widget.", 403, "FOREIGN_ORIGIN");
  }

  const ip = resolveRequestIp(request);
  const limit = await checkRateLimit("chat", { visitorId: payload.visitorId, ip, botId: bot.id });
  if (!limit.allowed) {
    logRefusal("widget.blocked", {
      code: "RATE_LIMITED",
      botId: bot.id,
      route: "chat",
      dimension: limit.dimension,
    });
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

  const streamHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    ...corsHeaders(request),
  };

  // Same turn, already generated: replay it rather than pay for it twice.
  if (payload.requestId) {
    const stored = await conversationRepository.findTurnByRequestId(conversation.id, payload.requestId);
    if (stored) {
      return new Response(replayStoredTurn(conversation.id, stored), { headers: streamHeaders });
    }
  }

  const messageCount = await countConversationMessages(conversation.id);
  if (messageCount >= WIDGET_MAX_MESSAGES_PER_CONVERSATION) {
    logRefusal("widget.blocked", { code: "CONVERSATION_LIMIT", botId: bot.id, route: "chat" });
    return err(
      request,
      "This conversation has reached its message limit. Please start a new one.",
      403,
      "CONVERSATION_LIMIT",
    );
  }

  // One bot must not be able to hold open an unbounded number of streams —
  // each one is an OpenAI completion we are paying for.
  const slot = await reserveGeneration(bot.id);
  if (!slot) {
    logRefusal("widget.blocked", { code: "BOT_BUSY", botId: bot.id, route: "chat" });
    return err(
      request,
      "This assistant is handling too many chats right now. Please try again in a moment.",
      429,
      "BOT_BUSY",
    );
  }

  // Anything that throws between the reservation and the stream would otherwise
  // hold the slot until its TTL, so it is given back on the way out.
  try {
    const historyRows = await conversationRepository.recentMessages(
      conversation.id,
      ANSWER_BUDGET.historyMessages,
    );
    const history: AnswerHistoryMessage[] = historyRows.map((row) => ({
      role: row.role,
      content: row.content,
    }));

    // The quota check happens inside the stream, before the model is ever
    // called, so a stream never dies mid-answer.
    const plan = (await getAccountPlan(bot.accountId)) ?? "free";

    const stream = streamChatTurn({
      channel: "widget",
      requestId: payload.requestId ?? randomUUID(),
      accountId: bot.accountId,
      plan,
      model: planLimits(plan).models[0],
      botId: bot.id,
      botInstruction: bot.systemPrompt,
      tone: bot.tone,
      fallbackMessage: bot.fallbackMessage,
      conversationId: conversation.id,
      question: payload.message,
      history,
      signal: request.signal,
    });

    return new Response(releaseGeneration(slot, stream), { headers: streamHeaders });
  } catch (error) {
    await releaseGenerationSlot(slot);
    throw error;
  }
}
