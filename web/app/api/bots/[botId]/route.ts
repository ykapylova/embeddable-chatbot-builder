import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonAck, jsonErr, jsonOk } from "server/http/json-api";
import { botService } from "server/services/bot.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ botId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId } = await context.params;
  const bot = await botService.get(botId, result.account.id);
  // Someone else's bot and a missing bot answer identically: the response must
  // not reveal that another account's resource exists.
  if (!bot) return jsonErr("Bot not found", 404);

  return jsonOk(bot);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  try {
    const bot = await botService.update(botId, result.account.id, body);
    if (!bot) return jsonErr("Bot not found", 404);
    return jsonOk(bot);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonErr(error.issues[0]?.message ?? "Invalid payload", 422);
    }
    console.error("[PATCH /api/bots/:botId]", error);
    return jsonErr("Could not update bot", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId } = await context.params;
  const removed = await botService.remove(botId, result.account.id);
  if (!removed) return jsonErr("Bot not found", 404);

  return jsonAck();
}
