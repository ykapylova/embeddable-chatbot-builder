# Embeddable Chatbot Builder — product spec (MVP)

> Status: specification, written before implementation.
> The repository and the database are built **from scratch**. The previous project (`web/` in the
> old repo) stays alongside as a code donor: specific modules are ported from it (see §3.1), but its
> history, README and database schema do not move over.
>
> **Companion documents:**
> `payments-and-subscriptions.md` — a breakdown of a production Stripe implementation from another
> project (flows, contracts, 50 edge cases and a "do it differently next time" list). §10.6–10.9
> here are built on it; read both when implementing billing.
> `DEV_PLAN.md` — order of work. `CLAUDE.md` — how this repository is worked on.

---

## 1. What the product is

A SaaS where a company uploads its documentation and internal knowledge and, within minutes, gets a
chatbot that answers questions about it.

The bot lives in two places:

1. **Inside the app** — a ChatGPT-like chat (a playground, and a working tool for the team).
2. **As an embeddable widget** — one `<script>` line on the customer's site, so that *their* users
   can ask questions.

Plus billing: plans, limits, upgrades through Stripe (test mode).

### Niche and positioning

Not "a bot builder for everyone", but something narrow: **first-line AI support for SaaS companies
and products with documentation**.

Landing page positioning: *"Your documentation already answers 80% of your tickets. Nobody reads
it."*

Three features follow from this that generic builders do not have, and that make the product
genuinely useful (see §4.3):

- answers **with links to the source** (trust, plus the option to read further);
- an **"unanswered questions" dashboard** — gaps in the documentation, closable in one click;
- **escalation with lead capture** when the bot does not know the answer, so the question is not
  lost.

---

## 2. Is Next.js the right fit

Yes — it is the right choice for this MVP.

| Need | How Next.js covers it |
| --- | --- |
| Landing page + SEO | App Router, static pages, RSC |
| The app (dashboard) | same project, route groups `(marketing)` / `(app)` |
| API + Stripe webhooks | Route Handlers, one deployment |
| Streaming answers | SSE from a Route Handler (Node runtime) — already implemented in the old repo |
| Widget | public route `/embed/[publicKey]` in an iframe + a static `widget.js` |
| Deployment | Vercel, already configured |

**Constraints to account for up front:**

1. **Indexing a knowledge base is slow** (parsing a PDF → chunks → embeddings). A serverless
   function is time-limited. The MVP answer: **one source per request**, `maxDuration = 60`, a loop
   over embedding batches, status in the database (`sources.status`), UI polling for progress. No
   step scheduler and no queue (Inngest/QStash) — the status machine is enough, and it also gives
   retry of a failed source.
2. **SSE needs the Node runtime**, not Edge (otherwise pg and the OpenAI SDK misbehave). Set
   `export const runtime = "nodejs"` explicitly.
3. **The widget must work on someone else's domain** — CORS, an `Origin` check, style isolation
   through an iframe.

So Next.js covers everything except heavy background indexing, and for an MVP that is handled with
statuses and a timeout.

---

## 3. Stack

| Layer | Technology | Note |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TS | |
| UI | Tailwind 4 + shadcn/ui | |
| Client state | TanStack Query | |
| Auth | Clerk | |
| Database | Supabase Postgres + **pgvector** | new Supabase project |
| ORM | Drizzle | connects over `DATABASE_URL`, not through supabase-js |
| Files | Supabase Storage | `knowledge-sources` bucket |
| LLM | OpenAI (`gpt-4o-mini` / `gpt-4o`) | |
| Embeddings | `text-embedding-3-small` (1536) | |
| Parsing | `pdf-parse`, `cheerio` (html) | |
| Billing | Stripe Checkout + Billing Portal + webhooks (test mode) | per `payments-and-subscriptions.md` |
| Validation | Zod | |

### 3.1 What gets ported from the old project

The repository is new, so this is not "reuse" but a **port of specific files** adapted to the new
domain. Copying everything is not an option — the old domain model would come along with the useful
parts.

| From (old `web/`) | What we take | Amount of change |
| --- | --- | --- |
| `lib/chat-turn-stream.ts` + `app/api/chats/[chatId]/turn` | SSE protocol `start` / `delta` / `done` / `error` | nearly as is |
| `server/services/openai-chat.service.ts` | OpenAI streaming wrapper | as is, different prompt |
| `components/chat/*` | message rendering, composer, autoscroll, markdown | rewritten into a single `ChatSurface` (§6) |
| `server/services/upload.service.ts`, `supabase-storage.service.ts` | MIME/size validation, name sanitising, signed URLs | as is, different bucket |
| `server/http/json-api.ts`, `lib/api-client.ts`, `lib/api-types/envelope.ts` | response envelope, error handling | as is |
| `middleware.ts` | Clerk route protection | rewritten: `/`, `/pricing`, `/embed/*`, `/api/public/*`, `/api/billing/webhook` are public |
| `server/env.ts` | env parsing and defaults | as is, different variable set |

**Not ported:** the database schema and migrations, guest mode and `anonymous_usage`,
`usage.service.ts`, `retrieval.service.ts` (a stub), `openai-document-upload.service.ts`,
`chat-principal.ts`.

Known debts of the old repo do not come along either: the schema path in `drizzle.config.ts` and the
`@/*` alias pointing at a non-existent `src/` are set up correctly from the start.

---

## 4. MVP scope

### 4.1 In scope

**Onboarding and bots**
- Sign up / sign in (Clerk).
- Create a bot: name, greeting, tone of voice, system instruction.
- Several bots per account, within the plan limit.

**Knowledge base**
- Sources: file upload (PDF, TXT, MD), pasted text, a URL, question–answer pairs (FAQ). DOCX is out
  of scope: an extra dependency for a format a PDF stands in for during the demo.
- Indexing: parse → chunk → embed → pgvector, with status and progress.
- Source list: status, size in characters, re-scan, delete.

**In-app chat**
- Playground: ChatGPT-like interface, streaming, conversation history.
- Source links under each answer.

**Widget**
- One `<script>` to embed, a bubble button and a chat window in an iframe.
- Customisation: colour, position, avatar, greeting, placeholder copy.
- Domain allowlist, branding removal on paid plans.
- Live preview in the dashboard — **the same React chat component**, rendered directly with
  different props, no iframe and no `postMessage`.

**Conversations and analytics**
- Conversation list from both widget and app, transcript view.
- Visitor rating of an answer (👍/👎).
- **Unanswered questions**: questions where the fallback fired or a 👎 was given, with an "Answer
  this" button that creates an FAQ source and reindexes.
- Usage counter: messages this period, knowledge base size.

**Leads**
- Contact form on escalation, lead list, CSV export (paid plans).

**Billing**
- 3 plans, Stripe Checkout, Billing Portal, webhooks, a "usage and plan" page.
- Limits enforced strictly on the server, with clear upgrade screens.

**Landing page**
- Home page describing the product, with a live demo widget on the page itself, and pricing.

### 4.2 Deliberately out of scope

Teams and roles, crawling a whole site via sitemap, integrations (Slack/Intercom/Zendesk),
interface localisation, prompt A/B tests, white labelling on a custom domain, a public API, voice
mode, topic clustering analytics, self-serve LLM provider switching, DOCX.

On billing specifically: plan changes and cancellation happen in the Stripe Billing Portal — we do
not build our own proration and confirmation screens (§10.6); there is no paid credit top-up
(§10.4).

### 4.3 What makes this more than another builder

1. **Source citations** — the document title and a link or anchor under every answer.
2. **Content gaps** — turns the bot's failures into a concrete documentation to-do list.
3. **Honest fallback** — the bot does not invent: on a low score it says it could not find the
   answer and offers to take a contact.

---

## 5. User journeys

### 5.1 Main path (owner)

```
Landing → Sign up → Create a bot (name + greeting)
      → Upload sources → wait for "Ready"
      → Playground: try 2–3 questions
      → Appearance: colour and position
      → Install: copy the <script>
      → Widget lives on the site
      → Conversations / Content gaps: improve the base
      → Credits running low → Upgrade → Stripe Checkout → Pro
```

Target time from sign-up to a working widget: **under 5 minutes**.

### 5.2 Visitor path (widget)

```
Lands on the customer's site → sees the bubble → opens it → asks a question
  → streamed answer + sources
  → 👍 / 👎
  → if the bot does not know → "Leave your email and we'll get back to you" → lead for the owner
```

The visitor **never signs up**. They are identified by an anonymous `visitor_id` in localStorage,
purely to stitch a conversation together.

---

## 6. Application structure

```
app/
├── (marketing)/
│   ├── page.tsx                      # landing page
│   └── pricing/page.tsx              # plans
├── (app)/
│   ├── dashboard/page.tsx            # bot list
│   └── bots/[botId]/
│       ├── page.tsx                  # playground (chat)
│       ├── knowledge/page.tsx        # sources
│       ├── appearance/page.tsx       # customisation + preview
│       ├── conversations/page.tsx    # conversations + content gaps
│       ├── leads/page.tsx            # leads
│       ├── install/page.tsx          # snippet and domains
│       └── settings/page.tsx         # prompt, fallback, deletion
│   ├── billing/page.tsx              # plan, usage, portal
│   └── layout.tsx                    # app sidebar
├── embed/[publicKey]/page.tsx        # widget UI inside the iframe (public)
└── api/
    ├── bots/…                        # bot CRUD
    ├── bots/[botId]/sources/…        # sources + indexing
    ├── bots/[botId]/chat             # SSE chat in the app
    ├── bots/[botId]/conversations/…  # conversations, gaps
    ├── bots/[botId]/leads/…
    ├── public/chat                   # widget SSE chat (CORS + Origin check)
    ├── public/feedback               # 👍/👎 from the widget
    ├── public/lead                   # lead from the widget
    ├── plans                         # public plan catalogue (single source)
    ├── billing/checkout              # first purchase only
    ├── billing/session-status        # verification after returning from Stripe
    ├── billing/portal                # Billing Portal: upgrade, downgrade, cancel, card
    └── billing/webhook               # Stripe webhooks (raw body)
components/
└── chat/chat-surface.tsx             # ONE chat component across three surfaces
public/
└── widget.js                         # widget loader
```

**One chat component, three surfaces.** `ChatSurface` is rendered with different props in the
playground (`variant="app"`), inside the widget iframe (`variant="widget"`, bot theme) and in the
Appearance preview (`variant="widget"`, theme from the form, no network). Two chat implementations
must never exist in this project — that is the main source of behavioural and visual drift.

---

## 7. Data model

```sql
-- Account (one user = one workspace in the MVP)
accounts        id, clerk_user_id, email, plan, created_at

bots            id, account_id, name, public_key, system_prompt, welcome_message,
                tone, fallback_message, theme jsonb, allowed_domains text[],
                branding_enabled bool, lead_capture_enabled bool,
                status, created_at, updated_at

sources         id, bot_id, type (file|url|text|faq), title, storage_key, source_url,
                status (pending|processing|ready|failed), error, char_count,
                chunk_count, created_at, indexed_at

chunks          id, source_id, bot_id, content, token_count,
                embedding vector(1536), metadata jsonb, chunk_index

conversations   id, bot_id, channel (app|widget), visitor_id, page_url,
                created_at, last_message_at, unresolved bool

messages        id, conversation_id, role (user|assistant), content,
                citations jsonb, rating smallint, model, credits, tokens,
                latency_ms, created_at

leads           id, bot_id, conversation_id, email, name, question, created_at

subscriptions   account_id, stripe_customer_id, stripe_subscription_id,
                plan, status, billing_interval, current_period_start,
                current_period_end, cancel_at_period_end, payment_failed, grace_until

usage_counters  account_id, period_start, credits_used, storage_chars

answer_cache    id, bot_id, question_hash, question, answer, citations jsonb,
                hits, created_at        -- instant repeat answers

processed_stripe_events  event_id pk, type, processed_at  -- webhook dedup
```

There is no separate `credit_events` table: spend is fully reconstructible from `messages`, which
already carries the model and token count, and a duplicate audit log would have to be kept
consistent.

**Indexes**

- `bots(account_id)`, unique `bots(public_key)`
- `sources(bot_id, created_at desc)`
- `chunks(bot_id)` + HNSW on `chunks.embedding` (cosine)
- `conversations(bot_id, last_message_at desc)`
- `messages(conversation_id, created_at)`
- partial index on `messages` for content gaps
- `usage_counters(account_id, period_start)` — unique
- `answer_cache(bot_id, question_hash)` — unique

**Data isolation:** every query against `chunks` / `conversations` is filtered by `bot_id`, and the
`bot_id` is verified to belong to the current user's `account_id`. Vector search **always** carries
`WHERE bot_id = $1` — knowledge leaking between accounts is unacceptable.

---

## 8. RAG pipeline

### Indexing

```
file / URL / text
  → parse (pdf-parse | cheerio | plain)
  → normalise (strip navigation, repeats, blank lines)
  → chunk: ~800 tokens, ~100 overlap, on paragraph boundaries
  → embeddings in batches of 96 chunks (text-embedding-3-small)
  → INSERT chunks
  → sources.status = ready
```

One source is processed per request, `maxDuration = 60`. Progress is stored in the database, the UI
polls `GET /api/bots/:id/sources` every 2 seconds and shows `processing → ready | failed` with a
readable error and a retry button. Changing a bot's sources invalidates that bot's `answer_cache`.

### Answering a question

```
question (+ last 4 messages for context)
  → normalise question → hash → answer_cache?
       └─ hit, and the conversation carries no context of its own → instant answer, no credit spent
  → embed the question
  → top-5 chunks by cosine, WHERE bot_id
  → cutoff at score < 0.35 → if empty → fallback answer + escalation
  → prompt: [static prefix] + numbered chunks + history
  → stream the answer (SSE)
  → parse [1][2] → citations
  → persist message + usage++ + write to answer_cache
```

Three decisions about cost and speed:

1. **Answer cache** keyed by `(bot_id, hash of the normalised question)`. Support widgets get the
   same questions over and over, so a meaningful share of traffic is answered instantly with no
   model call. The win is latency, not money. The cache is skipped when the conversation already
   carries context (a question like "what if I'm on annual billing?" depends on earlier turns).
2. **Top-5 instead of top-8** after the score cutoff: ~20% fewer input tokens and less noise in the
   context — answer quality usually goes up, not down.
3. **Static prompt prefix first** (rules plus the bot's instruction, ahead of the variable part) so
   that automatic prefix caching on the model side applies.

**Rules in the system prompt:** answer only from the context; never invent; cite by source number;
when there is no answer, say so plainly and offer to take a contact; answer in the language of the
question.

---

## 9. Widget architecture

**Embedding:**

```html
<script
  src="https://app.example.com/widget.js"
  data-bot-key="pk_live_a1b2c3"
  defer
></script>
```

**How it works:**

1. `widget.js` (~5–8 KB, no dependencies) reads `data-bot-key` and draws the bubble button.
2. On click it inserts `<iframe src="/embed/pk_...">` — the iframe gives full CSS and JS isolation
   from the customer's site.
3. The iframe and the parent talk over `postMessage`: `resize`, `open`, `close`, `unread`.
4. Public API: `window.ChatWidget.open() / .close() / .ask("text")`, so a customer can wire the bot
   to their own "Help" button.
5. Theme and greeting are supplied by the server from the `publicKey` when the iframe renders — no
   extra round trip.

**Security and abuse:**

- The `public_key` is not a secret; the real protection is server-side checks.
- `Origin` / `Referer` are checked against the bot's `allowed_domains`; a mismatch is a 403.
- Rate limiting: N messages per minute per `visitor_id`, per IP and per bot.
- Message length cap, and a cutoff after X messages in one conversation.
- The plan quota is checked **before** calling the LLM; when it is exhausted the visitor sees a
  polite placeholder and the owner gets a dashboard notice.
- CSP compatibility: no `eval`, inline styles only inside the iframe.

---

## 10. Pricing and gating

### 10.1 What the model is built on

**The value metric is an answered question.** Not the number of bots, not gigabytes, not seats. It
is the only one that grows with the customer's benefit (tickets deflected) and with our cost
(tokens). A customer with traffic pays more, and does not find that unfair.

**Cost of one answer** (a RAG request: ~3,000 input tokens = 8 chunks + history + system prompt,
~250 output; the question embedding is ≈ 0):

| Model | Input | Output | **Per answer** |
| --- | --- | --- | --- |
| `gpt-4o-mini` | $0.15 / 1M | $0.60 / 1M | **≈ $0.0006** |
| `gpt-4o` | $2.50 / 1M | $10.00 / 1M | **≈ $0.010** |

Indexing is essentially free: 5M characters ≈ 1.25M embedding tokens ≈ **$0.025 once**. So
knowledge base size is not a cost driver but a segment marker, and can be given generously.

**Hence credits rather than "messages".** An answer on `gpt-4o-mini` is **1 credit**, an answer on
`gpt-4o` is **5 credits**. This makes it possible to sell the advanced model without going
underwater, and describes both the limit and the upsell with a single number. The pattern is
familiar (Chatbase and Intercom count this way).

### 10.2 Plans

| | **Free** | **Pro — $29/mo** | **Business — $99/mo** |
| --- | --- | --- | --- |
| **Credits per month** | **100** | **2,000** | **10,000** |
| Bots | 1 | 3 | 10 |
| Knowledge base | 400k characters | 5M | 20M |
| Sources per bot | 5 | 100 | unlimited |
| Widget domains | 1 | 5 | unlimited |
| Model | `gpt-4o-mini` | `gpt-4o-mini` | + `gpt-4o` (5 credits/answer) |
| Source citations | ✅ | ✅ | ✅ |
| Honest fallback | ✅ | ✅ | ✅ |
| "Powered by" badge | required | removable | removable |
| Appearance customisation | colour | full | full |
| Lead capture | — | ✅ | ✅ |
| Content gaps | counter only | ✅ | ✅ |
| Conversation history | 7 days | 90 days | 12 months |
| CSV export | — | ✅ | ✅ |

Annual billing gives two months free (−17%): $290 and $990.

**Sanity check on the economics (worst case for cost):**

| Plan | Revenue | COGS at full usage | Gross margin |
| --- | --- | --- | --- |
| Free | $0 | $0.06 | — (cost of acquisition) |
| Pro | $29 | $1.20 | **96%** |
| Business (all on mini) | $99 | $6.00 | 94% |
| Business (all on `gpt-4o`, 2,000 answers) | $99 | $20.00 | **80%** |

Credits close the one real hole: "10,000 answers on `gpt-4o` for $99" would cost $100 — a loss on
every such customer. With credits the cost ceiling is fixed regardless of model choice.

### 10.3 What is gated, and why

The rule: **do not gate what stands between the user and first value; gate what matters after value
has been delivered.**

| Gate | Plan | Why this way |
| --- | --- | --- |
| Credits | all | The core metric: grows with the customer's traffic and with our cost |
| Second bot | Pro | A second bot means a second product or site — already business usage |
| Widget domains | Pro | One domain covers a real start; five covers agencies and multi-site |
| Remove "Powered by" | Pro | The classic brand gate: free widgets work for us |
| Lead capture | Pro | Direct monetisation for the customer: a bot failure becomes a contact |
| Content gaps | Pro | Free sees the **counter** ("12 unanswered questions") but not the list — a teaser, not a wall |
| Conversation history | per plan | Cheap to store, but a solid retention argument for upgrading |
| CSV export | Pro | A sign of a team process, not of a first impression |
| `gpt-4o` | Business | An expensive model on an expensive plan, plus the credit multiplier |
| Knowledge base size | per plan | Nearly free for us, but an honest segmentation by company size |

**Deliberately not gated:**

- source citations, honest fallback, streaming, speed — answer quality cuts trust in the whole
  product, and a free bot that answers badly kills the funnel;
- embedding the widget — the free plan must reach a real site, otherwise the product cannot be
  evaluated;
- deleting your own data and cancelling your subscription.

**Upgrade triggers (where the user meets the paid plan):**

1. 80% of credits consumed → in-app banner plus an email.
2. Trying to create a second bot.
3. Trying to add a second domain.
4. Clicking "Remove branding" in Appearance.
5. The first fallback without lead capture → "a customer's contact could have been here".
6. The Content gaps screen with a counter and a locked list.

All six lead to `/billing` with the reason highlighted — not to a generic price page.

### 10.4 Behaviour when the limit is reached

The widget sits on the **customer's public site**. Silently switching it off means embarrassing them
in front of their own visitors, so behaviour differs by plan:

| Plan | When credits run out |
| --- | --- |
| Free | The bot replies with a placeholder: "I can't answer right now, leave your contact" plus a form. The widget does not disappear |
| Pro / Business | A 10% grace buffer over the limit, then contact-collection mode plus an email to the owner |

There is no paid credit top-up in the MVP: it is a third separate Stripe flow (`mode: 'payment'`)
for a scenario that will not appear in the demo. The grace buffer and contact-collection mode fully
cover the "widget went quiet" problem. Top-ups are a post-launch item.

### 10.5 Implementing the gate

A single place — `server/services/plan.service.ts` — with limits declared once:

```ts
export const PLAN_LIMITS = {
  free:     { credits: 100,    bots: 1,  chars: 400_000,    sources: 5,        domains: 1,
              models: ["gpt-4o-mini"], branding: true,  leads: false, gaps: "counter",
              historyDays: 7,   export: false },
  pro:      { credits: 2_000,  bots: 3,  chars: 5_000_000,  sources: 100,      domains: 5,
              models: ["gpt-4o-mini"], branding: false, leads: true,  gaps: "full",
              historyDays: 90,  export: true },
  business: { credits: 10_000, bots: 10, chars: 20_000_000, sources: Infinity, domains: Infinity,
              models: ["gpt-4o-mini", "gpt-4o"], branding: false, leads: true, gaps: "full",
              historyDays: 365, export: true },
} as const;

export const CREDIT_COST = { "gpt-4o-mini": 1, "gpt-4o": 5 } as const;
```

- **There is exactly one plan catalogue, on the server.** The client hardcodes no prices, no limits
  and no `price_id`: everything comes from `GET /api/plans`. The landing page, `/billing` and the
  order summary all read one source. Four diverging copies of a catalogue is a known pain (see
  `payments-and-subscriptions.md` §2) and must not be repeated.
- Checked before the action: creating a bot, adding a source, sending a message, adding a domain,
  removing branding, exporting.
- On exceeding a limit: `402 Payment Required` plus a machine code (`LIMIT_CREDITS`, `LIMIT_BOTS`,
  `LIMIT_DOMAINS`, `FEATURE_LEADS`, `FEATURE_EXPORT`, …), a human message and an upgrade link
  carrying the reason. The UI shows a specific screen, not a generic error.
- Credits are charged **after a successful answer**, in a single atomic statement with a condition
  rather than read-check-write:

  ```sql
  UPDATE usage_counters
     SET credits_used = credits_used + $cost
   WHERE account_id = $1 AND period_start = $2
     AND credits_used + $cost <= $limit
  RETURNING credits_used;   -- empty result = limit exhausted
  ```

  Otherwise two concurrent requests break through the limit (the classic TOCTOU, a real bug in
  `payments-and-subscriptions.md` §9.38). A failed answer costs the customer nothing.

- Gating is always server-side, through **one mechanism** — `assertPlan(...)` at the top of the
  handler. No parallel decorators or guards "for later": two mechanisms diverge.
- **Locked, not deleted.** A downgrade deletes nothing: bots and sources over the new quota become
  inactive (the widget answers with a placeholder) and are marked in the UI with a lock and an
  "Upgrade to re-enable" banner. Upgrading restores everything instantly. Deleting someone's data
  over non-payment is not acceptable.
- A plan change applies immediately; the credit counter is not reset — it rolls over at
  `period_start` from Stripe.
- Until the plan resolves (`isPlanResolved === false`) nothing is blocked and no locks are drawn,
  otherwise a paying user sees a blocked interface flash after signing in.

**Deliberately out of the MVP:** a 14-day Pro trial, usage-based per-second billing, team seats,
custom enterprise plans, tax/VAT.

### 10.6 Billing implementation

> This section leans on `payments-and-subscriptions.md`, a breakdown of a production Stripe
> implementation in another project. Below: what carries over unchanged, and what is done
> differently following its own "do it differently next time" section.

**Source of truth.** There, it was Stripe, with the plan recomputed per request behind a 5-minute
in-memory cache — hence drift between instances and a plan resolver that failed when Stripe was
down. Here it is inverted:

- **Writes** go to Stripe (Checkout, Portal).
- **Reads** come from the `subscriptions` table in Postgres, updated by webhooks. No cache at all:
  reading our own database is faster, survives restarts, is identical across instances, and works
  even when Stripe is down.
- Drift is repaired by a manual "Sync from Stripe" button on `/billing` and by reconciliation on
  `checkout.session.completed`.

**Our code covers the first purchase only. Everything else is the Billing Portal.** This is the main
simplification relative to the source document:

| Action | How |
| --- | --- |
| First purchase (Free → Pro/Business) | our `POST /api/billing/checkout` → Stripe Checkout |
| Upgrade, downgrade between paid plans | **Billing Portal** (Stripe computes proration) |
| Cancel, reactivate | **Billing Portal** |
| Change card, view invoices | **Billing Portal** |
| State synchronisation | webhooks (needed regardless) |

What this removes from the project: the in-place `subscriptions.update` branch with
`always_invoice` / `error_if_incomplete` / post-update status check, the `preview-plan-change` and
`cancel-subscription` endpoints, the plan-switch confirmation modals, the downgrade warning and
their loading states. A whole class of bugs from §9.12–9.20 of the source document goes with them —
Stripe handles those on its side.

The price: on a plan change the user leaves for Stripe's domain, and we do not show our own "you
will be charged $X today" screen. For an MVP that is an honest trade; the fork from §5 of the source
document is worth building when plan changes become a frequent scenario — and then that document is
the ready-made instruction.

**The Portal is configured in the Stripe dashboard** — which plans can be switched to, whether
cancellation is allowed and when it takes effect. Set cancellation to **end of period**, not
immediate; that is the behaviour §10.4 and §10.8 assume.

**We do not trust the redirect from Stripe.** Stripe returns to `return_url` even when payment
failed. So `/billing?status=success&session_id=cs_…` is not treated as confirmation: the page calls
`GET /api/billing/session-status?sessionId=…`, which checks
`session.status === 'complete' && payment_status ∈ {paid, no_payment_required}` and compares
`metadata.clerkUserId` against the current user (otherwise someone else's `session_id` would reveal
their status → 403). While `incomplete`, it polls every 2 seconds. If the request itself fails we
show not an error but "Payment went through, syncing your plan" — the money was most likely taken
and the webhook will finish the job.

**Modal state lives in query parameters**, not in React state. That is what makes the return from
Stripe work: the user arrives at a URL with `?status=…&session_id=…` and the right screen opens by
itself.

**Downgrading to Free means cancelling at period end**, never "switching to a free price". The
cancellation itself happens in the Portal, but **our** screen comes first: the "Cancel subscription"
button opens a page listing the **specific** features that will be lost, and only then leads to the
Portal. While a cancellation is scheduled, `/billing` shows "Active until 14 Jul 2025" (from the
`customer.subscription.updated` webhook).

**Checkout: hosted, not embedded.** The source project used Embedded Checkout to keep users on its
own domain, which bought a separate route with `clientSecret` in `location.state`, a "session not
found" screen on reload, and double-mount handling under StrictMode. For the MVP we take hosted
Checkout: fewer states and less code, and post-return verification is needed either way.

### 10.7 Webhooks

Handler: `app/api/billing/webhook/route.ts`, `runtime = "nodejs"`, **raw body** via
`await req.text()` (the App Router does not parse the body itself — the same requirement as
`rawBody: true` in Nest), signature verified with `stripe.webhooks.constructEvent`.

| Event | Action |
| --- | --- |
| `checkout.session.completed` | store `stripe_customer_id` |
| `customer.subscription.created` | create `subscriptions`, raise `plan` |
| `customer.subscription.updated` | sync plan, interval, `cancel_at_period_end`, period |
| `customer.subscription.deleted` | move to `free` (the real end of paid access) |
| `invoice.payment_failed` | `payment_failed = true` plus an in-app banner |
| `invoice.payment_succeeded` | `payment_failed = false`, reset the credit counter for the new period |

With plan changes moved into the Portal, webhooks become the **only** channel through which we learn
about upgrades, downgrades and cancellations. So the three rules below stop being good practice and
become mandatory:

1. **Do not swallow errors.** A failing handler returns `500` so that Stripe retries. In the source
   project every handler was wrapped in a try/catch that answered 200 — one failure left a user
   without a `stripe_customer_id` and without a plan, permanently.
2. **Dedup on `event.id`** — a `processed_stripe_events (event_id pk, type, processed_at)` table,
   inserted before handling; a conflict means return 200 and stop. Stripe does not guarantee
   ordering, and after rule 1 retries become routine.
3. **Resolve the user by `stripe_customer_id` from our own database**, not by "the customer's most
   recent checkout session". `metadata.clerkUserId` is duplicated into both the session and
   `subscription_data.metadata` (the subscription webhook only sees the latter).

An unknown `price_id` (an old price, a subscription created by hand in the dashboard) does **not**
silently drop the user to Free — we log an error and keep the current plan, otherwise a paying
customer quietly loses features.

### 10.8 Edge cases that must be covered

The full catalogue is in `payments-and-subscriptions.md` §9. Mandatory for this MVP:

| # | Case | Handling |
| --- | --- | --- |
| 1 | Redirect from Stripe without payment | server-side session verification (§10.6) |
| 2 | Someone else's `session_id` in verification | compare `metadata.clerkUserId` → 403 |
| 3 | Card declined on upgrade | handled by the Portal; we receive the outcome by webhook |
| 4 | An existing payer clicks "Upgrade" again | send them to the Portal, not Checkout — no second subscription is created |
| 5 | Reactivation during grace | in the Portal; the webhook clears `cancel_at_period_end` |
| 6 | Downgrade with quota exceeded | locked, not deleted |
| 7 | Duplicate webhook delivery | dedup on `event.id` |
| 8 | Handler failure | 500 → Stripe retries |
| 9 | Plan changed in the Portal, our UI unaware | the webhook is the only sync path, so it has to be reliable (§10.7) |
| 10 | `payment_failed` on a live subscription | keep access for 7 days (grace) with a banner, then Free |
| 11 | Account deletion | **cancel the subscription in Stripe** — otherwise a deleted user keeps being charged |
| 12 | Portal button without a `stripe_customer_id` | show it only when `hasBillingHistory` |
| 13 | Race on credits | atomic `UPDATE … WHERE credits_used + cost <= limit` |
| 14 | Plan not loaded yet | block nothing, show skeletons rather than "Free" |

On #10: in the source project the statuses `past_due/unpaid/incomplete/paused` granted full access
indefinitely — a non-paying customer kept paid features until Stripe deleted the subscription
itself. We take the compromise: **7 days of grace with an explicit banner, then a drop to Free**
(data is not deleted).

**Billing security:** `userId` always comes from the Clerk token, never from a request body; the
client only ever sees `pk_test_…` and `price_…`; `sk_test_…` and `whsec_…` stay on the server;
`returnUrl` is allowlisted (open redirect protection).

### 10.9 Billing test plan

Cards: `4242…4242` succeeds, `4000 0000 0000 0002` is declined, `4000 0025 0000 3155` is 3DS.
Locally: `stripe listen --forward-to localhost:3000/api/billing/webhook`.

1. First purchase of Pro → plan raised, `customer_id` and `subscription_id` stored.
2. Declined card → "Payment cancelled", plan unchanged.
3. Closing Checkout halfway → nothing changed.
4. Upgrade Pro→Business **in the Portal** → webhook raises limits, credits not reset.
5. Downgrade Business→Pro in the Portal → bots over quota locked but not deleted.
6. Cancel in the Portal → "Active until …", features live to period end; reactivation without a
   charge.
7. `customer.subscription.deleted` (simulated) → back to Free.
8. Duplicate webhook → state intact.
9. Someone else's `session_id` in verification → 403.
10. Account deletion → subscription cancelled in Stripe.
11. Concurrent messages at the credit boundary → the limit is not breached.

---

## 11. Landing page

One page, blocks in this order:

1. **Hero** — "Turn your docs into a support agent that never sleeps", a subheading, a "Build your
   bot free" CTA, and "No credit card required" underneath.
2. **Live demo** — the widget right there on the landing page, trained on the product's own
   documentation. The strongest argument: a visitor tests the product before signing up.
3. **How it works** — three illustrated steps: Upload → Train → Embed.
4. **Features** — six cards: source citations, content gaps, lead capture, customisation, domain
   allowlist, analytics.
5. **The snippet** — a code block with the single embed line, visually proving "this is simple".
6. **Pricing** — three columns, a monthly/annual toggle (−17%), Pro marked "Most popular". Below the
   table, one line explaining credits: "1 credit = 1 answer. An answer on GPT-4o costs 5 credits",
   plus a "how many questions a day is enough for you" calculator.
7. **FAQ** — six questions: what a credit is, what happens at the limit, data and privacy,
   hallucinations and citations, languages, cancelling.
8. **Final CTA** and footer.

Copy tone: concrete, no "revolutionary AI". Numbers instead of adjectives.

---

## 12. Security

- Secrets (OpenAI, Stripe, service role) stay on the server, never in client bundles.
- Every write endpoint is validated with Zod.
- Resource ownership is checked on every request (`bot.account_id === current.account_id`).
- Public endpoints (`/api/public/*`): Origin check, rate limiting, body size limit.
- Uploads validated by MIME type and size.
- Source content is escaped when rendered (no `dangerouslySetInnerHTML` for content).
- Stripe webhook: signature verification is mandatory.
- Prompt injection from documents: content is supplied as data in a separate prompt section with an
  explicit instruction not to follow instructions found in the context.

---

## 13. Plan of work

**Principle: a vertical slice first, breadth second.** The riskiest piece is not the dashboard but a
widget that works on someone else's page. So it gets built in rough form during the first days
rather than in phase four — otherwise the deadline arrives with a beautiful dashboard and no widget.
The landing page comes last; it is the most predictable part.

| Phase | Contents | Result |
| --- | --- | --- |
| **0. Bootstrap** | New Next.js project (App Router, TS, Tailwind, shadcn, Drizzle, Clerk, TanStack Query), route groups, new Supabase with pgvector and the bucket, `0000_init` migration, modules ported per §3.1, CI | `npm run dev` starts, migrations applied, Clerk lets you into `/dashboard` |
| **1. Vertical slice** | The bare minimum along the whole chain, no polish: bot creation, one PDF upload, indexing, vector search, SSE answer, `widget.js` + `/embed/[publicKey]` | **One bot → one PDF → an answer in the widget on a local `demo.html`** |
| **2. Knowledge base** | The remaining source types (URL, text, FAQ), statuses and progress, list, reindexing, errors | Sources reach `ready`, failures are legible |
| **3. Chat and quality** | `ChatSurface` across three surfaces, citations, fallback, answer cache, playground, conversation history | The answers can be trusted |
| **4. Widget, properly** | Origin check and allowlist, Appearance + preview, Install page, branding, rate limits | The widget is ready for a third-party site |
| **5. Conversations** | Persisted conversations, transcript view, 👍/👎, content gaps, leads, export | The owner can see the value |
| **6. Billing** | `plan.service` + `GET /api/plans`, credits and atomic decrement, Checkout, Portal, session verification, webhooks with dedup, grace, limit screens | The §10.9 test plan is green |
| **7. Landing page** | All blocks, a demo widget on a real bot, pricing from `GET /api/plans`, copywriting | The product can be shown |
| **8. Polish** | Empty / loading / error states, mobile, demo data seed, README, demo video | Ready to submit |

> The numbering in `DEV_PLAN.md` is more granular; that document is the operational one.

---

## 14. Definition of done

**Functional**
- [ ] Sign-up to working widget in under 5 minutes.
- [ ] PDF/TXT/MD/URL/text/FAQ all index, and failures are explained clearly.
- [ ] Answers rest on the uploaded documents and carry source links.
- [ ] For a question outside the knowledge base the bot says "I don't know" instead of inventing.
- [ ] The widget genuinely works from a third-party HTML file or domain.
- [ ] A domain outside the allowlist gets a 403.
- [ ] Running out of credits moves the widget into contact-collection mode rather than breaking it.
- [ ] Stripe Checkout with a test card raises the plan through a webhook.
- [ ] A paying user changes and cancels their plan in the Billing Portal, and the state arrives by
      webhook.
- [ ] Cancelling keeps access to period end; reactivating does not charge again.
- [ ] A downgrade locks the excess but deletes nothing.
- [ ] A duplicate webhook does not corrupt state (dedup on `event.id`).
- [ ] Content gaps fill up and allow adding an FAQ in one click.
- [ ] Each of the six upgrade triggers (§10.3) leads to `/billing` with the reason highlighted.

**Qualitative**
- [ ] Every screen has empty, loading and error states.
- [ ] The app and the widget work at mobile widths.
- [ ] Copy is consistent, with no placeholders or lorem ipsum.
- [ ] No feature exists for show: everything in §4.1 appears in the demo script.
- [ ] The README takes a stranger from zero to running in 10 minutes.

---

## 15. Environment variables

```bash
# Database and storage
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=knowledge-sources

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# LLM
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
ANSWER_PROVIDER=openai            # openai | stub (tests and CI)

# Stripe (test mode) — price ids stay server-side, the client reads GET /api/plans
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 16. Demo script (5–6 minutes)

1. Landing page: scroll through, ask the demo widget a question right on the page.
2. Sign up.
3. Create a bot, upload a PDF and a URL, show indexing.
4. Playground: question → streaming → click a source.
5. A question outside the base → honest fallback → leave an email.
6. Appearance: change the colour, live preview.
7. Install: copy the snippet, paste it into a local `demo.html`, a working widget on "someone
   else's site".
8. Dashboard: the conversation from the widget, the lead, a content gap → add an FAQ → ask again,
   now it answers.
9. Free credits exhausted → upgrade → Stripe test card → Pro, limits raised.
