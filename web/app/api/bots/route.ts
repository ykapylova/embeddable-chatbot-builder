import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import { botService } from "server/services/bot.service";
import { PlanLimitError } from "server/services/plan.service";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const bots = await botService.list(result.account.id);
  return jsonOk(bots);
}

export async function POST(request: Request): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  try {
    const bot = await botService.create(result.account.id, result.account.plan, body);
    return jsonOk(bot, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonErr(error.issues[0]?.message ?? "Invalid payload", 422);
    }
    if (error instanceof PlanLimitError) {
      return jsonErr(error.message, 402, { code: error.code });
    }
    console.error("[POST /api/bots]", error);
    return jsonErr("Could not create bot", 500);
  }
}
