import { z, ZodError } from "zod";

import { jsonAck, jsonErr } from "server/http/json-api";
import { botRepository } from "server/repositories/bot.repository";
import { conversationRepository } from "server/repositories/conversation.repository";
import { leadRepository } from "server/repositories/lead.repository";
import { corsPreflight, withCors } from "server/services/widget/cors";
import { isHostAllowed, resolveRequestHost } from "server/services/widget/origin";

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

  const host = resolveRequestHost(request);
  if (!isHostAllowed(host, bot.allowedDomains)) {
    return err(request, "This site is not authorized to use this chat widget.", 403, "DOMAIN_NOT_ALLOWED");
  }

  if (!bot.leadCaptureEnabled) {
    return err(request, "Lead capture is not enabled for this assistant.", 403, "LEAD_CAPTURE_DISABLED");
  }

  // A conversation id is nice-to-have context, not a requirement: a visitor
  // can leave an email before ever asking a question.
  const conversation = payload.conversationId
    ? await conversationRepository.findOwned(payload.conversationId, bot.id)
    : null;

  await leadRepository.create({
    botId: bot.id,
    conversationId: conversation?.id ?? null,
    email: payload.email,
    name: payload.name || null,
    question: payload.question || null,
  });

  return withCors(request, jsonAck());
}
