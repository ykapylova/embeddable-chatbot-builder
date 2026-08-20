import { NextResponse } from "next/server";

import type { ConversationChannel } from "lib/api-types/conversation";
import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import { conversationService } from "server/services/conversation.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ botId: string }> };

function parseChannel(value: string | null): ConversationChannel | undefined {
  return value === "app" || value === "widget" ? value : undefined;
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId } = await context.params;
  const url = new URL(request.url);

  const response = await conversationService.list(
    botId,
    result.account.id,
    result.account.plan,
    {
      channel: parseChannel(url.searchParams.get("channel")),
      ratedDown: url.searchParams.get("rated") === "down",
      unresolved: url.searchParams.get("unresolved") === "true",
    },
    url.searchParams.get("cursor"),
  );
  if (!response) return jsonErr("Bot not found", 404);

  return jsonOk(response);
}
