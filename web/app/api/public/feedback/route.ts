import { z, ZodError } from "zod";

import { logRefusal } from "server/observability/log";
import { jsonAck, jsonErr } from "server/http/json-api";
import { botRepository } from "server/repositories/bot.repository";
import { conversationRepository } from "server/repositories/conversation.repository";
import { corsPreflight, withCors } from "server/services/widget/cors";
import { rateMessage } from "server/services/widget/message-rating";
import { isHostAllowed, resolveRequestHost } from "server/services/widget/origin";
import { checkRateLimit } from "server/services/widget/rate-limit";
import { resolveRequestIp } from "server/services/widget/request-ip";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  publicKey: z.string().trim().min(1, "publicKey is required"),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  rating: z.enum(["up", "down"]),
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

  let payload: z.infer<typeof feedbackSchema>;
  try {
    payload = feedbackSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return err(request, error.issues[0]?.message ?? "Invalid payload", 422);
    }
    throw error;
  }

  const bot = await botRepository.findByPublicKey(payload.publicKey);
  if (!bot) return err(request, "This assistant could not be found.", 404, "BOT_NOT_FOUND");

  const host = resolveRequestHost(request);
  if (!isHostAllowed(host, bot.allowedDomains)) {
    logRefusal("widget.blocked", { code: "DOMAIN_NOT_ALLOWED", botId: bot.id, route: "feedback", host });
    return err(request, "This site is not authorized to use this chat widget.", 403, "DOMAIN_NOT_ALLOWED");
  }

  // `rating = -1` is half of what the Content Gaps dashboard is built from, so
  // an unlimited endpoint here lets a stranger invent content gaps for a bot
  // they do not own. A visitor rates a handful of messages, never dozens.
  const limit = await checkRateLimit("feedback", {
    visitorId: payload.conversationId,
    ip: resolveRequestIp(request),
    botId: bot.id,
  });
  if (!limit.allowed) {
    logRefusal("widget.blocked", {
      code: "RATE_LIMITED",
      botId: bot.id,
      route: "feedback",
      dimension: limit.dimension,
    });
    return err(request, "Too many ratings — please wait a moment and try again.", 429, "RATE_LIMITED");
  }

  const conversation = await conversationRepository.findOwned(payload.conversationId, bot.id);
  if (!conversation) return err(request, "Conversation not found", 404);

  const updated = await rateMessage(payload.conversationId, payload.messageId, payload.rating);
  if (!updated) return err(request, "Message not found", 404);

  return withCors(request, jsonAck());
}
