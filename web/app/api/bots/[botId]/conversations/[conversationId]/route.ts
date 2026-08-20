import { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import { conversationService } from "server/services/conversation.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ botId: string; conversationId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId, conversationId } = await context.params;
  const transcript = await conversationService.transcript(botId, result.account.id, conversationId);
  if (!transcript) return jsonErr("Conversation not found", 404);

  return jsonOk(transcript);
}
