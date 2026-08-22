import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const planTierEnum = pgEnum("plan_tier", ["free", "pro", "business"]);
export const botStatusEnum = pgEnum("bot_status", ["active", "paused"]);
export const sourceTypeEnum = pgEnum("source_type", ["file", "url", "text", "faq"]);
export const sourceStatusEnum = pgEnum("source_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);
export const conversationChannelEnum = pgEnum("conversation_channel", ["app", "widget"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);
export const billingIntervalEnum = pgEnum("billing_interval", ["month", "year"]);

/**
 * How an assistant turn ended, recorded at write time rather than inferred
 * later from an empty citation list. `abstained` and `no_context` are the two
 * shapes of "the bot could not answer" and are what the Content Gaps screen
 * reads; `quota`, `aborted` and `error` are failures of ours, not of the
 * knowledge base, and must never be counted as gaps.
 */
export const answerStatusEnum = pgEnum("answer_status", [
  "answered",
  "abstained",
  "no_context",
  "quota",
  "aborted",
  "error",
]);

/** Why a source failed, in terms the UI can branch on — see PROJECT_SPEC.md and the §5 taxonomy. */
export const sourceErrorCodeEnum = pgEnum("source_error_code", [
  "PARSE_FAILED",
  "EMBEDDING_FAILED",
  "TIMEOUT",
  "UNSUPPORTED_CONTENT",
  "EMPTY_SOURCE",
  "STORAGE_FAILED",
  "LIMIT_CHARS",
  "UNKNOWN",
]);

// ─── Accounts and bots ──────────────────────────────────────────────────────

export const accountsTable = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),
  // Denormalised effective plan, read on every gating check. Billing truth
  // lives in `subscriptions` and is kept in sync by Stripe webhooks.
  plan: planTierEnum("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const botsTable = pgTable(
  "bots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Widget public key. Not a secret — access is bounded by allowedDomains,
    // rate limits and server-side plan quotas.
    publicKey: text("public_key").notNull().unique(),
    systemPrompt: text("system_prompt"),
    welcomeMessage: text("welcome_message").notNull(),
    tone: text("tone").notNull().default("friendly"),
    fallbackMessage: text("fallback_message").notNull(),
    theme: jsonb("theme").notNull().default({}),
    allowedDomains: text("allowed_domains").array().notNull().default([]),
    brandingEnabled: boolean("branding_enabled").notNull().default(true),
    leadCaptureEnabled: boolean("lead_capture_enabled").notNull().default(false),
    status: botStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("bots_account_id_idx").on(table.accountId)],
);

// ─── Knowledge base ─────────────────────────────────────────────────────────

export const sourcesTable = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => botsTable.id, { onDelete: "cascade" }),
    type: sourceTypeEnum("type").notNull(),
    title: text("title").notNull(),
    storageKey: text("storage_key"),
    sourceUrl: text("source_url"),
    status: sourceStatusEnum("status").notNull().default("pending"),
    error: text("error"),
    // The machine-readable half of `error`: the sentence is for the owner, the
    // code is what the UI branches on (offer Retry, link to /billing).
    errorCode: sourceErrorCodeEnum("error_code"),
    // Bumped when an indexing run starts, and carried into the run's commit so
    // a slow run whose version has moved on discards its own results instead
    // of overwriting a fresher one.
    indexVersion: integer("index_version").notNull().default(0),
    charCount: integer("char_count").notNull().default(0),
    chunkCount: integer("chunk_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [index("sources_bot_id_created_at_idx").on(table.botId, table.createdAt.desc())],
);

export const chunksTable = pgTable(
  "chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sourcesTable.id, { onDelete: "cascade" }),
    // botId is duplicated on purpose: vector search always filters by it, so the
    // hot path needs no join to sources.
    botId: uuid("bot_id")
      .notNull()
      .references(() => botsTable.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (table) => [
    index("chunks_bot_id_idx").on(table.botId),
    index("chunks_source_id_idx").on(table.sourceId),
    index("chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ],
);

// ─── Conversations ──────────────────────────────────────────────────────────

export const conversationsTable = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => botsTable.id, { onDelete: "cascade" }),
    channel: conversationChannelEnum("channel").notNull(),
    visitorId: text("visitor_id"),
    pageUrl: text("page_url"),
    unresolved: boolean("unresolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("conversations_bot_id_last_message_idx").on(table.botId, table.lastMessageAt.desc()),
  ],
);

export const messagesTable = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").notNull().default([]),
    rating: smallint("rating"),
    // Idempotency key for one turn, minted by the client and stable across its
    // Retry button. Only the assistant row carries it, which is what lets the
    // unique index below stand in for a lock: a second generation for the same
    // turn loses the insert race and replays the stored answer instead.
    requestId: text("request_id"),
    answerStatus: answerStatusEnum("answer_status"),
    // model/credits/tokens replace a separate spend audit log: account usage is
    // fully reconstructible from these rows.
    model: text("model"),
    credits: integer("credits").notNull().default(0),
    tokens: integer("tokens"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    // How the answer was produced, so "slow" and "wrong" can be resolved into
    // a stage instead of a guess. Vercel's log retention is short; these are
    // the durable half.
    cacheHit: boolean("cache_hit").notNull().default(false),
    retrievalCount: integer("retrieval_count"),
    topScore: real("top_score"),
    retrievalMs: integer("retrieval_ms"),
    firstTokenMs: integer("first_token_ms"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_conversation_id_created_at_idx").on(table.conversationId, table.createdAt),
    uniqueIndex("messages_conversation_request_idx").on(table.conversationId, table.requestId),
  ],
);

export const leadsTable = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => botsTable.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversationsTable.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    name: text("name"),
    question: text("question"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("leads_bot_id_created_at_idx").on(table.botId, table.createdAt.desc())],
);

// A repeated question is answered instantly without calling the model.
// Invalidated whenever the bot's sources change.
export const answerCacheTable = pgTable(
  "answer_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => botsTable.id, { onDelete: "cascade" }),
    questionHash: text("question_hash").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    citations: jsonb("citations").notNull().default([]),
    hits: integer("hits").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("answer_cache_bot_question_idx").on(table.botId, table.questionHash)],
);

// ─── Billing ────────────────────────────────────────────────────────────────

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    accountId: uuid("account_id")
      .primaryKey()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    plan: planTierEnum("plan").notNull().default("free"),
    // Text rather than an enum: Stripe keeps adding values (paused,
    // incomplete_expired, …) and a migration per status is not worth it.
    status: text("status"),
    billingInterval: billingIntervalEnum("billing_interval"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: "string" }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: "string" }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    paymentFailed: boolean("payment_failed").notNull().default(false),
    graceUntil: timestamp("grace_until", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("subscriptions_stripe_customer_id_idx").on(table.stripeCustomerId)],
);

export const usageCountersTable = pgTable(
  "usage_counters",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    creditsUsed: integer("credits_used").notNull().default(0),
    storageChars: bigint("storage_chars", { mode: "number" }).notNull().default(0),
  },
  (table) => [uniqueIndex("usage_counters_pk").on(table.accountId, table.periodStart)],
);

// Stripe webhook dedup: the row is inserted before the event is handled,
// so a conflict means a redelivery.
export const processedStripeEventsTable = pgTable("processed_stripe_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

// ─── Widget abuse controls ──────────────────────────────────────────────────

/**
 * Fixed-window request counters, shared by every instance.
 *
 * They live in Postgres rather than in process memory because a serverless
 * deployment runs many instances at once: a module-level Map makes "10 messages
 * a minute per visitor" mean "10 per visitor per warm lambda", which is no
 * limit at all against anything distributed. One row per (route, dimension,
 * key); the row is rewritten rather than appended to, so the table stays the
 * size of the traffic in one window.
 */
export const widgetRateLimitsTable = pgTable(
  "widget_rate_limits",
  {
    key: text("key").primaryKey(),
    hits: integer("hits").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [index("widget_rate_limits_expires_at_idx").on(table.expiresAt)],
);

/**
 * Concurrent generations per bot, one row per occupied slot.
 *
 * Numbered slots rather than a counter: claiming one is an insert on
 * `(bot_id, slot_no)`, so two instances racing for the last slot are settled by
 * the unique index instead of by whoever read the count first. `expires_at`
 * makes a lost release self-healing — a slot whose route died is reclaimable
 * once the TTL passes.
 */
export const widgetGenerationSlotsTable = pgTable(
  "widget_generation_slots",
  {
    botId: uuid("bot_id")
      .notNull()
      .references(() => botsTable.id, { onDelete: "cascade" }),
    slotNo: integer("slot_no").notNull(),
    // Held by the route that reserved the slot, and required to release it, so
    // a late release cannot free a slot that has since been reclaimed and
    // handed to a different generation.
    token: uuid("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [uniqueIndex("widget_generation_slots_pk").on(table.botId, table.slotNo)],
);
