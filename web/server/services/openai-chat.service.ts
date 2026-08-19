import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { env } from "../env";

export function getOpenAIClient(): OpenAI {
  const apiKey = env.openaiApiKey;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

export function defaultChatModel(): string {
  return env.openaiChatModel;
}

export async function createChatCompletionStream(messages: ChatCompletionMessageParam[]) {
  const client = getOpenAIClient();
  return client.chat.completions.create({
    model: defaultChatModel(),
    messages,
    stream: true,
  });
}

export async function generateShortChatTitle(firstUserMessage: string): Promise<string | null> {
  const input = firstUserMessage.trim();
  if (!input) return null;

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: defaultChatModel(),
    temperature: 0.2,
    max_tokens: 24,
    messages: [
      {
        role: "system",
        content:
          "Generate a concise chat title. Return plain text only, 2-6 words, no quotes, no markdown, no trailing punctuation.",
      },
      {
        role: "user",
        content: input,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) return null;
  const oneLine = raw.replace(/\s+/g, " ").trim();
  const noQuotes = oneLine.replace(/^["'`]+|["'`]+$/g, "").trim();
  const words = noQuotes.split(/\s+/).slice(0, 6);
  const title = words.join(" ").slice(0, 120).trim();
  return title || null;
}
