# Development plan

> Product spec: `PROJECT_SPEC.md`. This document is about order of work and phase boundaries.
>
> **Key decision:** everything is real from the start. The LLM stub is not a development phase —
> it is a test double behind a fixed interface.

---

## 1. Why there is no "build it on a stub" phase

The plan originally called for building the product against a stubbed LLM and connecting the model
at the end. That was dropped: **the integration is already written and working** in the previous
project and is ported over per §3.1 of the spec.

| | Status |
| --- | --- |
| OpenAI client, response streaming | done — `server/services/openai-chat.service.ts` |
| SSE protocol and buffering parser | done — `lib/chat-turn-stream.ts` |
| RAG prompt, context injection | to write |
| Citations, honest fallback | to write |
| Token and credit accounting | to write |

A stub pays for itself when the alternative is an unwritten streaming integration. Here the
alternative is porting proven code, and the remaining arguments do not survive scrutiny: iterating
on `gpt-4o-mini` costs $0.0006 per answer (a thousand development queries is 60 cents), and edge
states can be reproduced on the real provider too.

**What survives from the idea:** the `AnswerProvider` interface and a stub behind it — as a **test
double**, not a development mode. It is cheap and pays off immediately: end-to-end tests run in CI
without an OpenAI key, and states like "stream cut mid-answer", "empty retrieval" and "slow stream"
are reproduced deterministically instead of being caught by luck on a live model.

**What does not change:** retrieval and generation are still different things with different risks.

| | Retrieval (embeddings + search) | Generation (LLM) |
| --- | --- | --- |
| Determinism | total | iterative, needs tuning |
| What it validates | "are the right chunks found at all" | "how it is phrased" |
| Verifiable without an LLM | yes — by eye, over the top-5 chunks | no |
| **When** | **phase 3, before any generation** | **phase 4 (prompt v1), phase 8 (tuning)** |

The main product risk is not "the model writes badly" but "the right thing is not found in the
knowledge base". That is checked in phase 3 without calling a model at all, while chunking is still
cheap to fix. This was the real value of separating the two, and it stays.

### The seam contract

One interface, two implementations, selected by `ANSWER_PROVIDER=stub|openai`:

```ts
// server/services/answer/types.ts
export type RetrievedChunk = {
  id: string; sourceId: string; sourceTitle: string;
  content: string; score: number;
};

export type AnswerRequest = {
  botId: string;
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
  chunks: RetrievedChunk[];        // from retrieval.service — always real
  model: "gpt-4o-mini" | "gpt-4o";
  systemPrompt: string;
};

export type AnswerEvent =
  | { type: "start"; citations: Citation[] }
  | { type: "delta"; text: string }
  | { type: "done"; answered: boolean; usage: { tokens: number; credits: number } }
  | { type: "error"; code: string; message: string };

export interface AnswerProvider {
  answer(req: AnswerRequest): AsyncIterable<AnswerEvent>;
}
```

`OpenAiAnswerProvider` is the implementation used in development and production alike.
`StubAnswerProvider` exists only for tests and CI, and has exactly two requirements:

1. **It streams** in pieces with a delay rather than returning a finished string. A test that never
   exercises partial rendering and cancellation is worthless.
2. **It breaks on command** — cut mid-stream, empty retrieval, slow stream. On a live model these
   states are caught by accident; here they are deterministic.

Citations and `usage` are real in both implementations: citations come from retrieval rather than
from the model, and tokens come from the API response (the stub derives them from length). The same
test suite runs against both implementations — that is what proves the interface has not leaked.

---

## 2. Phases

Estimates are in working days and relative. Order matters more than estimates: every phase ends
with something that can be shown.

### Phase 0 — Bootstrap · ~0.5 day

Fresh Next.js project (App Router, TS, Tailwind, shadcn, Drizzle, Clerk, TanStack Query), route
groups `(marketing)` / `(app)`, fresh Supabase (pgvector + `knowledge-sources` bucket), applied
migration, modules ported per §3.1 of the spec, CI (lint + typecheck + build).

**Done when:** `npm run dev` starts, migrations are applied, Clerk lets you into `/dashboard`.

### Phase 1 — Accounts and bots · ~1 day

`accounts` created on first sign-in, bot CRUD, bot list on `/dashboard`, bot settings page (name,
welcome message, tone, system instruction, fallback), app shell with a sidebar, bot deletion.

**Done when:** a bot can be created, edited and deleted; someone else's bot is unreachable by
direct URL.

### Phase 2 — Sources and indexing · ~1.5 days

File upload (PDF/TXT/MD) to Storage, adding a URL, pasting text, FAQ pairs. Parse → normalise →
chunk → **real embeddings** → `chunks`. Status machine `pending → processing → ready | failed` with
a readable error and a retry button, progress polling, `char_count` / `chunk_count`, source
deletion.

**Done when:** a 30-page PDF reaches `ready`, and a broken file reaches `failed` with a message
that explains itself.

### Phase 3 — Retrieval without generation · ~0.5 day

Vector search, top-5, filtered by `bot_id`, with a score cutoff. In the playground, a **debug
panel**: ask a question, see the retrieved chunks with scores and sources. No generation.

**Done when:** for 10 real questions against the demo knowledge base, the right fragment is
consistently in the top 5. If it is not, chunking gets fixed (size, overlap, boundaries) — and that
is still cheap.

> Checkpoint. Everything after this is built on retrieval whose quality is already known.

### Phase 4 — Chat with real answers · ~2 days

`ChatSurface` — one component across three surfaces. SSE endpoint, `OpenAiAnswerProvider` behind
the §1 interface, prompt v1 (context only, never invent, cite by number, honest fallback, answer in
the question's language), `[1][2]` parsed into citations, the fallback → contact form path, 👍/👎
ratings, `conversations` / `messages` persisted with model and tokens, conversation history,
loading / error / cancelled states. Plus `StubAnswerProvider` and contract tests over both
implementations.

**Done when:** the bot answers from the documents with source links, and honestly says "I don't
know" plus a contact prompt for anything outside the knowledge base. The prompt is not polished
yet — that is phase 8.

### Phase 5 — Widget · ~1.5 days

`widget.js`, `/embed/[publicKey]`, `/api/public/chat` with CORS and an `Origin` check against the
allowlist, rate limits, the Appearance page (colour, position, avatar, greeting) with a live
preview on the same `ChatSurface`, the Install page with the snippet and domains, the
"Powered by" badge.

**Done when:** the widget works on a local `demo.html` served as a separate origin, and a domain
outside the allowlist gets a 403.

### Phase 6 — Conversations, gaps, leads · ~1 day

Conversation list with filters, transcript view, the "unanswered questions" dashboard with an
"Answer this" button that creates an FAQ source and reindexes, lead list, CSV export, usage counter.

**Done when:** a bot failure turns into an FAQ entry, and after reindexing the same question is
answered.

### Phase 7 — Billing · ~1.5 days

`plan.service` + `GET /api/plans` (single catalogue), credits with atomic decrement, Checkout for
the first purchase, Billing Portal for everything else, session verification after the return,
webhooks with dedup, grace period, limit screens and the six upgrade triggers, `/billing`.

**Done when:** the billing test plan in `PROJECT_SPEC.md` §10.9 is green.

### Phase 8 — Answer quality · ~0.5 day

Prompt tuning against a populated demo knowledge base rather than in a vacuum: phrasing, behaviour
on borderline questions, score cutoff, answer length. Static prompt prefix first, for caching.
Answer cache. Reconcile actual cost and latency with the numbers in `PROJECT_SPEC.md` §10.1.

**Done when:** across 15 questions to the demo base the answers are accurate and cited, and across
5 questions outside it the bot never invents anything.

### Phase 9 — Landing page · ~1 day

All the blocks from §11 of the spec, a live demo widget backed by a real bot trained on the
product's own documentation, pricing from `GET /api/plans`, FAQ, copywriting.

### Phase 10 — Polish and delivery · ~1 day

Empty / loading / error states everywhere, mobile for both app and widget, demo data seed, README
(from zero to running in 10 minutes), a full run of the demo script in §16 of the spec, recording.

**Total ≈ 11.5 days.**

---

## 3. Risks

**Answer quality.** Covered by the ordering: retrieval is eyeballed in phase 3, working generation
exists from phase 4, and phase 8 is polish on a populated base rather than a first attempt. By the
time tuning starts, both halves have worked separately for a while, so it is obvious which one is
limping.

**The widget on a third-party domain** (phase 5) is the least predictable piece: CORS, iframes,
`Origin`. So the end of phase 5 requires a run on a real external domain, not `localhost` — static
hosting on Vercel, for instance. Finding out the `Origin` check is broken in phase 10 is bad.

**Indexing large files** (phase 2) runs into the serverless timeout. Test with a 100+ page PDF
immediately, not with a five-page demo file.

---

## 4. What gets cut if time runs short

In order, first to go first:

1. CSV export and the separate leads page (leads stay, shown inside the conversation).
2. Annual billing (monthly only) — removes half the price catalogue.
3. Content gaps down to a counter without the "Answer this" button (the dashboard stays, FAQ
   auto-creation goes).
4. URL sources (files, text and FAQ remain).
5. Answer cache.

**Never cut, under any circumstances:** source citations, honest fallback, a widget that works on
an external domain, an upgrade that completes end to end, the landing page. This is what the
product is judged on.

---

## 5. Working rules

- Every phase ends with a working demonstration, not "a finished layer".
- Provider selection happens once, through `ANSWER_PROVIDER`. No `if (isStub)` in business logic:
  the stub lives behind the interface or not at all.
- Any new plan limit goes **only** into `PLAN_LIMITS`. A constant duplicated in a component is a
  defect.
- Vector search always carries `WHERE bot_id` — verify it in every review.
- One branch per phase, PR into `main`, CI required. See `CLAUDE.md`.
