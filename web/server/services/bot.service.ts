import { randomBytes } from "node:crypto";
import { z } from "zod";

import type { Bot, BotListItem } from "lib/api-types/bot";
import {
  BOT_DEFAULTS,
  BOT_MESSAGE_MAX,
  BOT_NAME_MAX,
  BOT_PROMPT_MAX,
  BOT_TONES,
} from "lib/bot-defaults";
import { botRepository, type BotRow } from "server/repositories/bot.repository";

const toneValues = BOT_TONES.map((t) => t.value) as [string, ...string[]];

export const createBotSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(BOT_NAME_MAX),
});

export const updateBotSchema = z
  .object({
    name: z.string().trim().min(1).max(BOT_NAME_MAX).optional(),
    systemPrompt: z.string().trim().max(BOT_PROMPT_MAX).nullable().optional(),
    welcomeMessage: z.string().trim().min(1).max(BOT_MESSAGE_MAX).optional(),
    fallbackMessage: z.string().trim().min(1).max(BOT_MESSAGE_MAX).optional(),
    tone: z.enum(toneValues).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: "Nothing to update" });

/**
 * Widget public key. Not a secret — it sits in a <script> tag on the customer's
 * site, so what protects it is not unguessability but the allowedDomains check,
 * rate limiting and plan quotas applied to every request made with it.
 */
function generatePublicKey(): string {
  return `pk_${randomBytes(16).toString("hex")}`;
}

function toBot(row: BotRow): Bot {
  return {
    id: row.id,
    name: row.name,
    publicKey: row.publicKey,
    systemPrompt: row.systemPrompt,
    welcomeMessage: row.welcomeMessage,
    fallbackMessage: row.fallbackMessage,
    tone: row.tone,
    allowedDomains: row.allowedDomains,
    brandingEnabled: row.brandingEnabled,
    leadCaptureEnabled: row.leadCaptureEnabled,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const botService = {
  async list(accountId: string): Promise<BotListItem[]> {
    const rows = await botRepository.listByAccount(accountId);
    return rows.map((row) => ({ ...toBot(row), sourceCount: row.sourceCount }));
  },

  async get(botId: string, accountId: string): Promise<Bot | null> {
    const row = await botRepository.findOwned(botId, accountId);
    return row ? toBot(row) : null;
  },

  async create(accountId: string, input: unknown): Promise<Bot> {
    const { name } = createBotSchema.parse(input);

    const row = await botRepository.create({
      accountId,
      name,
      publicKey: generatePublicKey(),
      welcomeMessage: BOT_DEFAULTS.welcomeMessage,
      fallbackMessage: BOT_DEFAULTS.fallbackMessage,
      tone: BOT_DEFAULTS.tone,
    });

    return toBot(row);
  },

  async update(botId: string, accountId: string, input: unknown): Promise<Bot | null> {
    const patch = updateBotSchema.parse(input);
    const row = await botRepository.update(botId, accountId, {
      ...patch,
      systemPrompt: patch.systemPrompt === "" ? null : patch.systemPrompt,
    });
    return row ? toBot(row) : null;
  },

  async remove(botId: string, accountId: string): Promise<boolean> {
    return botRepository.remove(botId, accountId);
  },
};
