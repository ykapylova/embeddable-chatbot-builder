import { randomBytes } from "node:crypto";
import { z } from "zod";

import type { Bot, BotListItem } from "lib/api-types/bot";
import {
  BOT_DEFAULTS,
  BOT_MESSAGE_MAX,
  BOT_NAME_MAX,
  BOT_PROMPT_MAX,
  BOT_TONES,
  THEME_PLACEHOLDER_MAX,
} from "lib/bot-defaults";
import type { PlanId } from "lib/plans";
import { botRepository, type BotRow } from "server/repositories/bot.repository";
import { sourceRepository } from "server/repositories/source.repository";
import { assertPlan } from "server/services/plan.service";
import { discardSourceBlobs } from "server/services/sources/storage-cleanup.service";

const toneValues = BOT_TONES.map((t) => t.value) as [string, ...string[]];

export const createBotSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(BOT_NAME_MAX),
});

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// A hostname only: no scheme, no path, no port. This is a security control
// (PROJECT_SPEC.md §9), not a nicety — it is what stops the widget being
// embedded on a domain its owner does not control.
const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

const themeSchema = z
  .object({
    accentColor: z
      .string()
      .regex(HEX_COLOR_PATTERN, "Accent colour must be a hex value like #4f46e5")
      .optional(),
    avatarUrl: z.string().trim().url("Avatar must be a valid URL").max(2048).nullable().optional(),
    placeholder: z.string().trim().max(THEME_PLACEHOLDER_MAX).optional(),
    position: z.enum(["bottom-right", "bottom-left"]).optional(),
  })
  .strict();

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Domain is required")
  .max(253, "Domain is too long")
  .refine((v) => !/^[a-z]+:\/\//i.test(v), "Enter a hostname, not a URL — no protocol")
  .refine((v) => !v.includes("/"), "Enter a hostname, not a URL — no path")
  .refine((v) => DOMAIN_PATTERN.test(v), "Not a valid domain, e.g. app.example.com");

const allowedDomainsSchema = z.array(domainSchema).superRefine((domains, ctx) => {
  const seen = new Set<string>();
  for (const domain of domains) {
    if (seen.has(domain)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate domain: ${domain}` });
      return;
    }
    seen.add(domain);
  }
});

export const updateBotSchema = z
  .object({
    name: z.string().trim().min(1).max(BOT_NAME_MAX).optional(),
    systemPrompt: z.string().trim().max(BOT_PROMPT_MAX).nullable().optional(),
    welcomeMessage: z.string().trim().min(1).max(BOT_MESSAGE_MAX).optional(),
    fallbackMessage: z.string().trim().min(1).max(BOT_MESSAGE_MAX).optional(),
    tone: z.enum(toneValues).optional(),
    theme: themeSchema.optional(),
    allowedDomains: allowedDomainsSchema.optional(),
    brandingEnabled: z.boolean().optional(),
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

/**
 * `theme` is stored as unvalidated jsonb, so a row written before this field
 * existed (or edited outside `updateBotSchema`) must not crash the response —
 * only recognised, correctly-typed keys survive.
 */
function toBotTheme(raw: unknown): Bot["theme"] {
  if (typeof raw !== "object" || raw === null) return {};
  const theme = raw as Record<string, unknown>;
  const result: Bot["theme"] = {};

  if (typeof theme.accentColor === "string") result.accentColor = theme.accentColor;
  if (typeof theme.avatarUrl === "string" || theme.avatarUrl === null) {
    result.avatarUrl = theme.avatarUrl as string | null;
  }
  if (typeof theme.placeholder === "string") result.placeholder = theme.placeholder;
  if (theme.position === "bottom-right" || theme.position === "bottom-left") {
    result.position = theme.position;
  }

  return result;
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
    theme: toBotTheme(row.theme),
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

  async create(accountId: string, plan: PlanId, input: unknown): Promise<Bot> {
    const { name } = createBotSchema.parse(input);
    await assertPlan({ type: "bots", accountId, plan });

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

  async update(botId: string, accountId: string, input: unknown, plan: PlanId): Promise<Bot | null> {
    const patch = updateBotSchema.parse(input);

    // Gating lives here, not only in the form: a Free account calling the API
    // directly must not be able to remove branding or exceed its domain quota.
    if (patch.allowedDomains) {
      await assertPlan({ type: "domains", plan, requestedDomainCount: patch.allowedDomains.length });
    }

    if (patch.brandingEnabled === false) {
      await assertPlan({ type: "branding", plan });
    }

    const row = await botRepository.update(botId, accountId, {
      ...patch,
      systemPrompt: patch.systemPrompt === "" ? null : patch.systemPrompt,
    });
    return row ? toBot(row) : null;
  },

  /**
   * Sources cascade away in SQL when the bot row goes, which is why their
   * storage keys have to be read while the rows still exist. The read is not an
   * ownership check — the delete below is still scoped by `accountId`, and the
   * keys are only used once it reports that a row of this account's was removed.
   */
  async remove(botId: string, accountId: string): Promise<boolean> {
    const sources = await sourceRepository.listByBot(botId);

    const removed = await botRepository.remove(botId, accountId);
    if (!removed) return false;

    await discardSourceBlobs(sources.map((source) => source.storageKey));
    return true;
  },
};
