import type { LeadListItem, LeadListResponse } from "lib/api-types/leads";
import { planLimits, type PlanId } from "lib/plans";
import { botRepository } from "server/repositories/bot.repository";
import { leadRepository, type LeadCursor, type LeadRow } from "server/repositories/lead.repository";

const PAGE_SIZE = 20;

export class LeadExportNotAllowedError extends Error {}

function encodeCursor(row: Pick<LeadRow, "createdAt" | "id">): string {
  return Buffer.from(`${row.createdAt}|${row.id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): LeadCursor | null {
  try {
    const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function toItem(row: LeadRow): LeadListItem {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    question: row.question,
    conversationId: row.conversationId,
    createdAt: row.createdAt,
  };
}

/** Quotes a field only when it needs it, doubling embedded quotes — RFC 4180. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(rows: LeadRow[]): string {
  const lines = [
    ["Email", "Name", "Question", "Created at"].join(","),
    ...rows.map((row) =>
      [row.email, row.name ?? "", row.question ?? "", row.createdAt].map(csvField).join(","),
    ),
  ];
  return lines.join("\r\n");
}

export const leadService = {
  async list(botId: string, accountId: string, cursorParam: string | null): Promise<LeadListResponse | null> {
    const bot = await botRepository.findOwned(botId, accountId);
    if (!bot) return null;

    const cursor = cursorParam ? decodeCursor(cursorParam) : null;
    const { rows, hasMore } = await leadRepository.listPage(botId, { limit: PAGE_SIZE, cursor });

    const last = rows[rows.length - 1];
    return {
      items: rows.map(toItem),
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  },

  /** Returns null for an unowned/missing bot, throws for a plan that can't export —
   * the two failure modes need different HTTP statuses at the route layer. */
  async exportCsv(botId: string, accountId: string, plan: PlanId): Promise<string | null> {
    const bot = await botRepository.findOwned(botId, accountId);
    if (!bot) return null;

    if (!planLimits(plan).export) {
      throw new LeadExportNotAllowedError("CSV export requires a Pro plan.");
    }

    const rows = await leadRepository.listAllForExport(botId);
    return toCsv(rows);
  },
};
