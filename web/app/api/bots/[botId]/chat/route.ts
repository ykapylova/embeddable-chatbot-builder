import { randomUUID } from "node:crypto";

import { z, ZodError } from "zod";

import { planLimits } from "lib/plans";
import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr } from "server/http/json-api";
import { botRepository } from "server/repositories/bot.repository";
import { conversationRepository } from "server/repositories/conversation.repository";
import { ANSWER_BUDGET, type AnswerHistoryMessage } from "server/services/answer";
import { replayStoredTurn, streamChatTurn } from "server/services/chat/turn.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ botId: string }> };

const chatTurnSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Message is required").max(ANSWER_BUDGET.questionChars),
  /**
   * Idempotency key for this turn: new for a new question, unchanged when the
   * client retries it. Optional so an older widget still works — it just gives
   * up the replay guarantee.
   */
  requestId: z.string().uuid().optional(),
});

const streamHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;
  const { account } = result;

  const { botId } = await context.params;
  const bot = await botRepository.findOwned(botId, account.id);
  if (!bot) return jsonErr("Bot not found", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  let payload: z.infer<typeof chatTurnSchema>;
  try {
    payload = chatTurnSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonErr(error.issues[0]?.message ?? "Invalid payload", 422);
    }
    throw error;
  }

  const conversation = payload.conversationId
    ? await conversationRepository.findOwned(payload.conversationId, botId)
    : await conversationRepository.create({ botId, channel: "app" });

  if (!conversation) return jsonErr("Conversation not found", 404);

  // Retry after a stream that died once the model had already run must not
  // generate — or charge for — the same turn twice.
  if (payload.requestId) {
    const stored = await conversationRepository.findTurnByRequestId(conversation.id, payload.requestId);
    if (stored) {
      return new Response(replayStoredTurn(conversation.id, stored), { headers: streamHeaders });
    }
  }

  const historyRows = await conversationRepository.recentMessages(
    conversation.id,
    ANSWER_BUDGET.historyMessages,
  );
  const history: AnswerHistoryMessage[] = historyRows.map((row) => ({
    role: row.role,
    content: row.content,
  }));

  const stream = streamChatTurn({
    channel: "app",
    requestId: payload.requestId ?? randomUUID(),
    accountId: account.id,
    plan: account.plan,
    model: planLimits(account.plan).models[0],
    botId,
    botInstruction: bot.systemPrompt,
    tone: bot.tone,
    fallbackMessage: bot.fallbackMessage,
    conversationId: conversation.id,
    question: payload.message,
    history,
    signal: request.signal,
  });

  return new Response(stream, { headers: streamHeaders });
}
