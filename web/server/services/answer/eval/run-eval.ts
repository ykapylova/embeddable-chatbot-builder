/**
 * Answer-quality eval harness (T14). Not a unit test — it talks to the real
 * database and the real model, so it is run by hand, never by `npm run verify`:
 *
 *   cd web
 *   DOTENV_CONFIG_PATH=.env.local node --import tsx --require dotenv/config \
 *     server/services/answer/eval/run-eval.ts
 *
 * It seeds a throwaway bot from the product's own documentation, runs every
 * question in `tasks/eval-questions.md` through retrieval and the model under
 * both the old absolute cutoff and the new relative rule, prints the comparison,
 * writes the latest table back into the eval file, and deletes the bot again.
 */

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";

import { getDb } from "server/db/client";
import { accountsTable, botsTable } from "server/db/schema";
import { chunkRepository, type RelevantChunkRow } from "server/repositories/chunk.repository";
import { sourceRepository } from "server/repositories/source.repository";
import { openAiAnswerProvider } from "server/services/answer/openai-answer.provider";
import { ingestSource } from "server/services/sources/ingest.service";
import { embedTexts } from "server/services/sources/embed.service";

// The tuning constants under comparison. The "new" pair mirrors
// retrieval.service.ts; the old one is the absolute cutoff it replaced.
const OLD_CUTOFF = 0.35;
const SCORE_FLOOR = 0.22;
const RELATIVE_MARGIN = 0.12;
const TOP_K = 5;

const REPO_ROOT = resolve(process.cwd(), "..");
// Run from `web/`; the eval set is tracked next to this harness.
const EVAL_FILE = resolve(process.cwd(), "server/services/answer/eval/eval-questions.md");
const FALLBACK = "I don't have that in my documentation — I can pass your question to the team.";

type Question = { kind: "in" | "out"; text: string };
type Row = {
  kind: "in" | "out";
  text: string;
  top: number;
  oldKept: number;
  newKept: number;
  answered: boolean;
  latencyMs: number;
  tokens: number;
  answer: string;
};

function parseQuestions(): Question[] {
  const md = readFileSync(EVAL_FILE, "utf-8");
  const questions: Question[] = [];
  for (const match of md.matchAll(/^- \[(in|out)\] (.+)$/gm)) {
    questions.push({ kind: match[1] as "in" | "out", text: match[2].trim() });
  }
  return questions;
}

function applyNewRule(candidates: RelevantChunkRow[]): RelevantChunkRow[] {
  const floored = candidates.filter((c) => c.score >= SCORE_FLOOR);
  if (floored.length === 0) return [];
  const best = floored[0].score;
  return floored.filter((c) => c.score >= best - RELATIVE_MARGIN).slice(0, TOP_K);
}

async function answer(question: string, chunks: RelevantChunkRow[]) {
  let text = "";
  let citations: { index: number; sourceId: string; sourceTitle: string; sourceUrl: string | null }[] = [];
  let answered = false;
  let tokens = 0;
  const startedAt = Date.now();

  for await (const event of openAiAnswerProvider.answer({
    question,
    history: [],
    chunks,
    model: "gpt-4o-mini",
    botInstruction: null,
    tone: "friendly",
    fallbackMessage: FALLBACK,
  })) {
    if (event.type === "start") citations = event.citations;
    else if (event.type === "delta") text += event.text;
    else if (event.type === "done") {
      answered = event.answered;
      tokens = event.usage.tokens;
    }
  }

  return { text, answered, tokens, latencyMs: Date.now() - startedAt };
}

function renderTable(rows: Row[]): string {
  const header =
    "| Q | Kind | Top | old→n | new→n | ans | ms | tok |\n" +
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |";
  const body = rows
    .map((r, i) => {
      const q = r.text.length > 46 ? `${r.text.slice(0, 44)}…` : r.text;
      return `| ${i + 1}. ${q} | ${r.kind} | ${r.top.toFixed(3)} | ${r.oldKept} | ${r.newKept} | ${r.answered ? "✅" : "—"} | ${r.latencyMs} | ${r.tokens} |`;
    })
    .join("\n");
  return `${header}\n${body}`;
}

function summarise(rows: Row[]): string {
  const inRows = rows.filter((r) => r.kind === "in");
  const outRows = rows.filter((r) => r.kind === "out");
  const oldReachable = inRows.filter((r) => r.oldKept > 0).length;
  const newReachable = inRows.filter((r) => r.newKept > 0).length;
  const inAnswered = inRows.filter((r) => r.answered).length;
  // A fabrication is an out-of-corpus question the bot answered instead of
  // refusing. `answered` is now the refusal signal itself — it is false exactly
  // when the model returned the fallback sentence — so it is what to count.
  const fabrications = outRows.filter((r) => r.answered).length;
  const reachedModel = outRows.filter((r) => r.newKept > 0).length;
  const answeredTokens = rows.filter((r) => r.tokens > 0).map((r) => r.tokens);
  const avgTokens = answeredTokens.length
    ? Math.round(answeredTokens.reduce((a, b) => a + b, 0) / answeredTokens.length)
    : 0;
  // gpt-4o-mini output is $0.60/1M; total tokens are input-dominated so this is
  // an upper bound on the per-answer cost.
  const estCost = ((avgTokens * 0.6) / 1_000_000).toFixed(5);

  return [
    `In-corpus reachable: old ${oldReachable}/${inRows.length}, new ${newReachable}/${inRows.length}`,
    `In-corpus answered rather than refused (new): ${inAnswered}/${inRows.length}`,
    `Out-of-corpus fabrications (answered with a citation, must be 0): ${fabrications}/${outRows.length}`,
    `Out-of-corpus that reached the model but abstained in text: ${reachedModel}/${outRows.length}`,
    `Avg total tokens on a model answer: ${avgTokens} (~$${estCost} upper bound per answer)`,
  ].join("\n");
}

function writeResults(table: string, summary: string): void {
  const md = readFileSync(EVAL_FILE, "utf-8");
  const stamp = new Date().toISOString().slice(0, 10);
  const block = `<!-- results:latest -->\n\n### Latest run (${stamp})\n\n${summary}\n\n${table}\n`;
  writeFileSync(EVAL_FILE, md.replace(/<!-- results:latest -->[\s\S]*$/, block));
}

async function main(): Promise<void> {
  const questions = parseQuestions();
  if (questions.length === 0) throw new Error("No questions parsed from the eval file");

  const spec = readFileSync(resolve(REPO_ROOT, "PROJECT_SPEC.md"), "utf-8");
  const readme = readFileSync(resolve(REPO_ROOT, "README.md"), "utf-8");

  const db = getDb();
  const [account] = await db
    .insert(accountsTable)
    .values({ clerkUserId: `eval-${randomUUID()}`, email: "eval@local.test", plan: "business" })
    .returning();
  const [bot] = await db
    .insert(botsTable)
    .values({
      accountId: account.id,
      name: "T14 eval bot",
      publicKey: `pk_eval_${randomUUID()}`,
      welcomeMessage: "Hi",
      fallbackMessage: FALLBACK,
      systemPrompt: null,
      tone: "friendly",
    })
    .returning();

  try {
    for (const [title, text] of [
      ["PROJECT_SPEC", spec],
      ["README", readme],
    ] as const) {
      const row = await sourceRepository.create({ botId: bot.id, type: "text", title });
      const claimed = (await sourceRepository.beginIndexing(row.id, bot.id)) ?? row;
      const done = await ingestSource(claimed, text, account.plan, claimed.indexVersion);
      console.log(`ingested ${title}: ${done.status}, ${done.chunkCount} chunks`);
    }

    const rows: Row[] = [];
    for (const q of questions) {
      const [embedding] = await embedTexts([q.text]);
      const candidates = await chunkRepository.findRelevant(bot.id, embedding, { limit: 8, minScore: 0 });
      const top = candidates[0]?.score ?? 0;
      const oldKept = candidates.filter((c) => c.score >= OLD_CUTOFF);
      const newKept = applyNewRule(candidates);
      const result = await answer(q.text, newKept);
      rows.push({
        kind: q.kind,
        text: q.text,
        top,
        oldKept: oldKept.length,
        newKept: newKept.length,
        answered: result.answered,
        latencyMs: result.latencyMs,
        tokens: result.tokens,
        answer: result.text,
      });
      console.log(`[${q.kind}] ${top.toFixed(3)} old=${oldKept.length} new=${newKept.length} ans=${result.answered} :: ${q.text}`);
      if (q.kind === "out" && result.answered) console.log(`   ⚠ OUT-OF-CORPUS ANSWERED: ${result.text}`);
    }

    const table = renderTable(rows);
    const summary = summarise(rows);
    console.log(`\n${summary}\n\n${table}`);
    writeResults(table, summary);
  } finally {
    // Cascade drops the bot, its sources, chunks, conversations and cache.
    await db.delete(accountsTable).where(eq(accountsTable.id, account.id));
    console.log("cleaned up eval account");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
