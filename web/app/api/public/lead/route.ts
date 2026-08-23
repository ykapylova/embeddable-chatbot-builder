import { z, ZodError } from "zod";

import { env } from "server/env";
import { logRefusal } from "server/observability/log";
import { jsonAck, jsonErr } from "server/http/json-api";
import { botRepository } from "server/repositories/bot.repository";
import { conversationRepository } from "server/repositories/conversation.repository";
import { leadRepository } from "server/repositories/lead.repository";
import { corsPreflight, withCors } from "server/services/widget/cors";
import { isSelfOriginated, resolveRequestHost } from "server/services/widget/origin";
import { checkRateLimit } from "server/services/widget/rate-limit";
import { resolveRequestIp } from "server/services/widget/request-ip";

export const runtime = "nodejs";

const leadSchema = z.object({
  publicKey: z.string().trim().min(1, "publicKey is required"),
  conversationId: z.string().uuid().optional(),
  email: z.string().trim().email("Enter a valid email address").max(320),
  name: z.string().trim().max(120).optional(),
  question: z.string().trim().max(2000).optional(),
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

  let payload: z.infer<typeof leadSchema>;
  try {
    payload = leadSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return err(request, error.issues[0]?.message ?? "Invalid payload", 422);
    }
    throw error;
  }

  const bot = await botRepository.findByPublicKey(payload.publicKey);
  if (!bot) return err(request, "This assistant could not be found.", 404, "BOT_NOT_FOUND");

  // The bot's allowed domains are enforced on the iframe's own navigation, in
  // app/embed/[publicKey]/page.tsx — this call is same-origin from inside that
  // iframe, so its Origin says nothing about the site the visitor is on. What
  // is still worth asking here is whether the caller is that iframe at all.
  if (!isSelfOriginated(request, env.appUrl)) {
    logRefusal("widget.blocked", {
      code: "FOREIGN_ORIGIN",
      botId: bot.id,
      route: "lead",
      host: resolveRequestHost(request),
    });
    return err(request, "This request did not come from the chat widget.", 403, "FOREIGN_ORIGIN");
  }

  if (!bot.leadCaptureEnabled) {
    return err(request, "Lead capture is not enabled for this assistant.", 403, "LEAD_CAPTURE_DISABLED");
  }

  // The domain check is not the barrier on this endpoint — the widget runs on
  // the customer's own site, so it is the thing an attacker already satisfies.
  // Without a limit here, the Leads screen and its CSV export are anyone's to
  // fill with junk. The conversation stands in for the visitor: this endpoint
  // carries no visitor id, and one lead per conversation is the shape of the
  // real thing.
  const limit = await checkRateLimit("lead", {
    visitorId: payload.conversationId ?? payload.email,
    ip: resolveRequestIp(request),
    botId: bot.id,
  });
  if (!limit.allowed) {
    logRefusal("widget.blocked", {
      code: "RATE_LIMITED",
      botId: bot.id,
      route: "lead",
      dimension: limit.dimension,
    });
    return err(request, "Too many submissions — please wait a moment and try again.", 429, "RATE_LIMITED");
  }

  // A conversation id is nice-to-have context, not a requirement: a visitor
  // can leave an email before ever asking a question.
  const conversation = payload.conversationId
    ? await conversationRepository.findOwned(payload.conversationId, bot.id)
    : null;

  // One conversation, one lead. A visitor who submits the form twice has
  // already been captured; a script pointed at one conversation gets nowhere.
  if (conversation && (await leadRepository.existsForConversation(conversation.id))) {
    return withCors(request, jsonAck());
  }

  await leadRepository.create({
    botId: bot.id,
    conversationId: conversation?.id ?? null,
    email: payload.email,
    name: payload.name || null,
    question: payload.question || null,
  });

  return withCors(request, jsonAck());
}
