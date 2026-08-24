/**
 * Seeds a demo account: one bot, a real knowledge base and the traffic it has
 * already handled — including a content gap and the lead it captured.
 *
 * An empty dashboard is correct engineering and a terrible first impression,
 * and both of the things that make this product more than a chat box (gaps and
 * leads) are invisible until someone has actually failed to get an answer.
 *
 *   npm run seed                          # demo@example.com, Pro
 *   npm run seed -- --plan=free           # Free, for the upgrade-trigger demo
 *   npm run seed -- --plan=free --credits-used=100   # Free, out of credits
 *   npm run seed -- --email=me@x.com      # attach the data to an existing sign-in
 *
 * Re-running is safe: the demo bot is deleted and rebuilt, and nothing else in
 * the account is touched.
 *
 * The knowledge base goes through `sourceService`, so the blobs, the chunking
 * and the embeddings are the real ones and the seeded bot answers new questions
 * as well as a hand-built one. Conversations are written straight through
 * Drizzle instead: they have to be backdated, and `appendMessage` deliberately
 * stamps `lastMessageAt` with the wall clock so live ordering cannot be faked.
 */

import { randomBytes } from "node:crypto";

import { createClerkClient } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";

import { planLimits, type PlanId } from "lib/plans";
import { getDb } from "server/db/client";
import {
  accountsTable,
  botsTable,
  conversationsTable,
  leadsTable,
  messagesTable,
  usageCountersTable,
} from "server/db/schema";
import { env } from "server/env";
import { getPlanUsage } from "server/services/plan.service";
import { sourceService } from "server/services/sources/source.service";

import { DEMO_BOT, DEMO_CONVERSATIONS, DEMO_SOURCES, DOCSY_BOT, DOCSY_SOURCES } from "./seed-content";

const DEFAULT_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "harbor-demo-4417";

type Options = { email: string; plan: PlanId; password: string; creditsUsed: number | null };

function parseOptions(argv: string[]): Options {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (match) flags.set(match[1], match[2]);
  }

  const plan = flags.get("plan") ?? "pro";
  if (plan !== "free" && plan !== "pro" && plan !== "business") {
    throw new Error(`--plan must be free, pro or business (got "${plan}")`);
  }

  const creditsRaw = flags.get("credits-used");
  const creditsUsed = creditsRaw === undefined ? null : Number.parseInt(creditsRaw, 10);
  if (creditsUsed !== null && !Number.isInteger(creditsUsed)) {
    throw new Error(`--credits-used must be a whole number (got "${creditsRaw}")`);
  }

  return {
    email: flags.get("email") ?? DEFAULT_EMAIL,
    plan,
    password: flags.get("password") ?? DEMO_PASSWORD,
    creditsUsed,
  };
}

function requireEnv() {
  const missing: string[] = [];
  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (!env.openaiApiKey) missing.push("OPENAI_API_KEY");
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) missing.push("SUPABASE_* (url + service key)");
  if (!process.env.CLERK_SECRET_KEY) missing.push("CLERK_SECRET_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Cannot seed without ${missing.join(", ")}. Fill them in web/.env.local — see README.md.`,
    );
  }
}

/**
 * The sign-in has to exist in Clerk before the app will let anyone see the
 * seeded data, and creating it here is the difference between "run one command"
 * and "run one command, then read a paragraph".
 */
async function ensureClerkUser(email: string, password: string): Promise<string> {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  const existing = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
  if (existing.data.length > 0) {
    console.log(`  Clerk user already exists (${email}) — password left as it is`);
    return existing.data[0].id;
  }

  const user = await clerk.users.createUser({
    emailAddress: [email],
    password,
    // A demo password is deliberately memorable, which every breach list agrees
    // is a bad password. This account holds fictional coffee orders.
    skipPasswordChecks: true,
  });
  console.log(`  Created Clerk user ${email}`);
  return user.id;
}

async function ensureAccount(clerkUserId: string, email: string, plan: PlanId): Promise<string> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.clerkUserId, clerkUserId))
    .limit(1);

  if (existing) {
    await db.update(accountsTable).set({ plan }).where(eq(accountsTable.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(accountsTable)
    .values({ clerkUserId, email, plan })
    .returning();
  return created.id;
}

/** Drops a previous run's bots so re-seeding does not stack four Harbor bots. */
async function dropPreviousBot(accountId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: botsTable.id })
    .from(botsTable)
    .where(
      and(
        eq(botsTable.accountId, accountId),
        inArray(botsTable.name, [DEMO_BOT.name, DOCSY_BOT.name]),
      ),
    );

  for (const row of rows) {
    // Sources, chunks, conversations, messages and leads all cascade from here.
    await db.delete(botsTable).where(eq(botsTable.id, row.id));
  }
  if (rows.length > 0) console.log(`  Removed ${rows.length} bot(s) from a previous seed`);
}

type BotSpec = {
  name: string;
  welcomeMessage: string;
  fallbackMessage: string;
  systemPrompt: string;
  tone: string;
  theme: { accentColor: string; placeholder: string };
  allowedDomains: readonly string[];
  leadCapture: boolean;
};

async function createBot(accountId: string, spec: BotSpec): Promise<{ id: string; publicKey: string }> {
  const db = getDb();
  const [row] = await db
    .insert(botsTable)
    .values({
      accountId,
      name: spec.name,
      publicKey: `pk_${randomBytes(16).toString("hex")}`,
      systemPrompt: spec.systemPrompt,
      welcomeMessage: spec.welcomeMessage,
      fallbackMessage: spec.fallbackMessage,
      tone: spec.tone,
      theme: spec.theme,
      allowedDomains: [...spec.allowedDomains],
      // Free cannot remove the badge, so leaving it on keeps the seeded bots
      // legal on every plan this script can produce.
      brandingEnabled: true,
      leadCaptureEnabled: spec.leadCapture,
    })
    .returning({ id: botsTable.id, publicKey: botsTable.publicKey });
  return row;
}

/** The hostname the app is served from, which the landing page's widget must be allowed to run on. */
function appHostname(): string {
  try {
    return new URL(env.appUrl).hostname;
  } catch {
    return "localhost";
  }
}

/** Title → source id, so the seeded citations point at real documents. */
type SourceSpec =
  | { kind: "text"; title: string; content: string }
  | { kind: "faq"; question: string; answer: string };

async function indexKnowledgeBase(
  botId: string,
  accountId: string,
  plan: PlanId,
  specs: readonly SourceSpec[],
): Promise<Map<string, { id: string; title: string }>> {
  const byTitle = new Map<string, { id: string; title: string }>();

  for (const source of specs) {
    const input =
      source.kind === "text"
        ? { type: "text" as const, title: source.title, content: source.content }
        : { type: "faq" as const, question: source.question, answer: source.answer };

    const created = await sourceService.create(botId, accountId, plan, input);
    if (!created) throw new Error("The demo bot vanished while its sources were being indexed");
    if (created.status !== "ready") {
      throw new Error(`Source "${created.title}" ended as ${created.status}: ${created.error ?? "no reason given"}`);
    }

    byTitle.set(created.title, { id: created.id, title: created.title });
    console.log(`  Indexed "${created.title}" — ${created.chunkCount} chunk${created.chunkCount === 1 ? "" : "s"}`);
  }

  return byTitle;
}

function at(daysAgo: number, minuteOffset: number): string {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 + minuteOffset * 60 * 1000);
  return date.toISOString();
}

async function writeHistory(
  botId: string,
  sources: Map<string, { id: string; title: string }>,
  plan: PlanId,
): Promise<{ conversations: number; credits: number; leads: number; gaps: number }> {
  const capturesLeads = planLimits(plan).leads;
  const db = getDb();
  let credits = 0;
  let leads = 0;
  let gaps = 0;

  for (const turn of DEMO_CONVERSATIONS) {
    const askedAt = at(turn.daysAgo, 0);
    const answeredAt = at(turn.daysAgo, 1);
    const answered = turn.cites.length > 0;

    const citations = turn.cites.map((title, index) => {
      const source = sources.get(title);
      if (!source) throw new Error(`Seeded conversation cites an unknown source: "${title}"`);
      return { index: index + 1, sourceId: source.id, sourceTitle: source.title, sourceUrl: null };
    });

    const [conversation] = await db
      .insert(conversationsTable)
      .values({
        botId,
        channel: turn.channel,
        visitorId: turn.channel === "widget" ? `visitor_${randomBytes(8).toString("hex")}` : null,
        pageUrl: turn.pageUrl ?? null,
        // A turn that could not be answered is what "needs attention" means.
        unresolved: !answered,
        createdAt: askedAt,
        lastMessageAt: answeredAt,
      })
      .returning({ id: conversationsTable.id });

    await db.insert(messagesTable).values([
      {
        conversationId: conversation.id,
        role: "user",
        content: turn.question,
        createdAt: askedAt,
      },
      {
        conversationId: conversation.id,
        role: "assistant",
        content: turn.answer,
        citations,
        rating: turn.rating ?? null,
        model: "gpt-4o-mini",
        // An answer nobody could give is not billed — the routes refund it, and
        // seeded history has to agree with that or the usage figure is fiction.
        credits: answered ? 1 : 0,
        tokens: 320 + turn.answer.length,
        latencyMs: 1400 + turn.answer.length,
        createdAt: answeredAt,
      },
    ]);

    if (answered) credits += 1;
    if (!answered || turn.rating === -1) gaps += 1;

    if (turn.lead && capturesLeads) {
      await db.insert(leadsTable).values({
        botId,
        conversationId: conversation.id,
        email: turn.lead.email,
        name: turn.lead.name,
        question: turn.question,
        createdAt: at(turn.daysAgo, 2),
      });
      leads += 1;
    }
  }

  return { conversations: DEMO_CONVERSATIONS.length, credits, leads, gaps };
}

/**
 * Records the period's usage against the account, and nothing else.
 *
 * An earlier draft also wrote a `subscriptions` row so the billing page would
 * show a renewal date — which invented a state the product cannot produce: an
 * `active` subscription with no Stripe customer behind it. Checkout then refused
 * ("you already have a subscription, manage it in the portal") while the portal
 * refused right back ("no billing history yet"), so both billing buttons on the
 * demo account were dead ends pointing at each other.
 *
 * `accounts.plan` is the denormalised plan every gating check reads, so setting
 * it alone is enough for a seeded Pro account to behave like one — and leaving
 * the billing tables empty is the truth: this account has never paid. Upgrading
 * it through Stripe from the demo is then a real first purchase.
 */
async function writeUsage(accountId: string, plan: PlanId, credits: number): Promise<void> {
  const db = getDb();

  // Asking the app where the period starts, rather than recomputing it: an
  // account that has paid before still has a subscription row, and its period
  // wins over the rolling one. Guessing wrong writes the counter to a row
  // nothing reads, and the dashboard shows 0 credits used.
  const { periodStart } = await getPlanUsage(accountId, plan);

  await db
    .insert(usageCountersTable)
    .values({ accountId, periodStart, creditsUsed: credits })
    .onConflictDoUpdate({
      target: [usageCountersTable.accountId, usageCountersTable.periodStart],
      set: { creditsUsed: credits },
    });
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  requireEnv();

  console.log(`Seeding the ${options.plan} demo account…`);

  const clerkUserId = await ensureClerkUser(options.email, options.password);
  const accountId = await ensureAccount(clerkUserId, options.email, options.plan);
  await dropPreviousBot(accountId);

  const bot = await createBot(accountId, {
    ...DEMO_BOT,
    leadCapture: planLimits(options.plan).leads,
  });
  const sources = await indexKnowledgeBase(bot.id, accountId, options.plan, DEMO_SOURCES);
  const history = await writeHistory(bot.id, sources, options.plan);

  // The landing page demos the product with the product (PROJECT_SPEC.md §11),
  // which needs a second bot — so Free, which allows one, does not get it.
  let docsy: { id: string; publicKey: string } | null = null;
  if (planLimits(options.plan).bots > 1) {
    docsy = await createBot(accountId, {
      ...DOCSY_BOT,
      allowedDomains: [...new Set([appHostname(), "localhost"])],
      leadCapture: planLimits(options.plan).leads,
    });
    await indexKnowledgeBase(docsy.id, accountId, options.plan, DOCSY_SOURCES);
  }

  // Overriding the counter deliberately desyncs it from the seeded messages, so
  // it is opt-in: it exists to stage the "out of credits" screens on demand.
  await writeUsage(accountId, options.plan, options.creditsUsed ?? history.credits);

  console.log(
    [
      "",
      "Done.",
      "",
      `  Sign in     ${env.appUrl}/sign-in`,
      `  Email       ${options.email}`,
      `  Password    ${options.password}`,
      "",
      `  Bot         ${DEMO_BOT.name} (${options.plan})`,
      `  Public key  ${bot.publicKey}`,
      `  Knowledge   ${sources.size} sources`,
      `  History     ${history.conversations} conversations, ${history.gaps} gaps, ${history.leads} lead${history.leads === 1 ? "" : "s"}`,
      `  Credits     ${options.creditsUsed ?? history.credits} used this period`,
      `  Playground  ${env.appUrl}/bots/${bot.id}`,
      "",
      ...(docsy
        ? [
            "  To put the live widget on the landing page, add this to .env.local",
            "  and restart the dev server:",
            "",
            `    NEXT_PUBLIC_DEMO_BOT_KEY=${docsy.publicKey}`,
            "",
          ]
        : [
            `  The ${DOCSY_BOT.name} bot behind the landing-page widget needs a second bot slot,`,
            "  so this Free account did not get one. Seed with --plan=pro for it.",
            "",
          ]),
    ].join("\n"),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeeding failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
