import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonAck, jsonErr } from "server/http/json-api";
import { conversationService } from "server/services/conversation.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ botId: string; conversationId: string }> };

const ratingSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum(["up", "down"]).nullable(),
});

/**
 * The Playground's counterpart to the public feedback route. The widget's one
 * cannot serve it: that one identifies the bot by its public key and only
 * checks that the caller is the embed iframe, which says nothing about who owns
 * the conversation being rated.
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  let payload: z.infer<typeof ratingSchema>;
  try {
    payload = ratingSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonErr(error.issues[0]?.message ?? "Invalid payload", 422);
    }
    throw error;
  }

  const { botId, conversationId } = await context.params;
  const rated = await conversationService.rateMessage(
    botId,
    result.account.id,
    conversationId,
    payload.messageId,
    payload.rating,
  );
  if (!rated) return jsonErr("Message not found", 404);

  return jsonAck();
}
