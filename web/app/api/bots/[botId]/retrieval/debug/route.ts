import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import type { RetrievalDebugResponse } from "lib/api-types/retrieval";
import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import { botRepository } from "server/repositories/bot.repository";
import { findRelevantChunks } from "server/services/retrieval.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ botId: string }> };

const debugSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(2000),
});

/**
 * No answer is generated here — this exists so relevance can be judged by
 * eye before any model is involved (see `DEV_PLAN.md` §1).
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId } = await context.params;
  const bot = await botRepository.findOwned(botId, result.account.id);
  if (!bot) return jsonErr("Bot not found", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  try {
    const { question } = debugSchema.parse(body);
    const chunks = await findRelevantChunks(botId, question);
    return jsonOk<RetrievalDebugResponse>({ chunks });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonErr(error.issues[0]?.message ?? "Invalid payload", 422);
    }
    console.error("[POST /api/bots/:botId/retrieval/debug]", error);
    return jsonErr("Could not run retrieval", 500);
  }
}
