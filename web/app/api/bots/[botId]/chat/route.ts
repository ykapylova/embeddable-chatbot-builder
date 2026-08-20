import { z, ZodError } from "zod";

import type { ChatCitation, ChatStreamEvent } from "lib/api-types/chat";
import { planLimits } from "lib/plans";
import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr } from "server/http/json-api";
import { botRepository } from "server/repositories/bot.repository";
import { conversationRepository } from "server/repositories/conversation.repository";
import { getAnswerProvider, usedCitations, type AnswerHistoryMessage, type RetrievedChunk } from "server/services/answer";
import { findRelevantChunks } from "server/services/retrieval.service";

export const runtime = "nodejs";

/** Only the last 4 turns go into the prompt — see PROJECT_SPEC.md §8. */
const HISTORY_LIMIT = 4;

type RouteContext = { params: Promise<{ botId: string }> };

const chatTurnSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Message is required").max(4000),
});

const encoder = new TextEncoder();

function toChatCitations(citations: { index: number; sourceId: string; sourceTitle: string; sourceUrl: string | null }[]): ChatCitation[] {
  return citations.map((c) => ({
    index: c.index,
    sourceId: c.sourceId,
    sourceTitle: c.sourceTitle,
    sourceUrl: c.sourceUrl,
  }));
}

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

  // History is loaded before the new user turn is stored, so it never
  // duplicates the question that is about to be answered.
  const historyRows = await conversationRepository.recentMessages(conversation.id, HISTORY_LIMIT);
  const history: AnswerHistoryMessage[] = historyRows.map((row) => ({
    role: row.role,
    content: row.content,
  }));

  await conversationRepository.appendMessage({
    conversationId: conversation.id,
    role: "user",
    content: payload.message,
  });

  const model = planLimits(account.plan).models[0];
  const provider = getAnswerProvider();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let assistantText = "";
      let citations: ChatCitation[] = [];
      let answered = false;
      let usage = { tokens: 0, credits: 0 };
      let errored: { code: string; message: string } | null = null;
      let closed = false;

      const send = (event: ChatStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const onAbort = () => {
        closed = true;
      };
      request.signal.addEventListener("abort", onAbort);

      try {
        const rawChunks = await findRelevantChunks(botId, payload.message);
        const chunks: RetrievedChunk[] = rawChunks.map((chunk) => ({
          id: chunk.id,
          sourceId: chunk.sourceId,
          sourceTitle: chunk.sourceTitle,
          sourceUrl: null,
          content: chunk.content,
          score: chunk.score,
        }));

        for await (const event of provider.answer({
          question: payload.message,
          history,
          chunks,
          model,
          botInstruction: bot.systemPrompt,
          tone: bot.tone,
          fallbackMessage: bot.fallbackMessage,
        })) {
          if (request.signal.aborted) break;

          if (event.type === "start") {
            citations = toChatCitations(event.citations);
            send({ type: "start", conversationId: conversation.id, citations });
          } else if (event.type === "delta") {
            assistantText += event.text;
            send(event);
          } else if (event.type === "done") {
            answered = event.answered;
            usage = event.usage;
            send(event);
          } else {
            errored = { code: event.code, message: event.message };
            send(event);
          }

          if (request.signal.aborted) break;
        }
      } catch (error) {
        console.error("[POST /api/bots/:botId/chat]", error);
        errored = { code: "INTERNAL", message: "The assistant could not finish this answer. Please try again." };
        send({ type: "error", ...errored });
      } finally {
        request.signal.removeEventListener("abort", onAbort);

        // Persisted even on error or client disconnect: a half-written answer
        // must not look like data loss to the user re-opening the conversation.
        if (assistantText || answered || errored) {
          const keptCitations = usedCitations(assistantText, citations);

          await conversationRepository.appendMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: assistantText,
            citations: keptCitations,
            model,
            credits: usage.credits,
            tokens: usage.tokens || null,
            latencyMs: Date.now() - startedAt,
          });
        }

        try {
          controller.close();
        } catch {
          // already closed by an aborted client
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
