# Embeddable Chatbot Builder

Upload your company docs and get a chatbot that answers questions about them — inside the app, and
as a widget you embed on your own site.

Answers cite the document they came from, and the bot says "I don't know" instead of inventing.
When it cannot answer, it offers to take the visitor's contact details, and the unanswered question
shows up in the dashboard as a gap in your documentation.

## Status

| Phase | State |
| --- | --- |
| 0. Bootstrap | ✅ done |
| 1. Accounts and bots | ✅ done |
| 2. Knowledge sources and indexing | ✅ done |
| 3. Retrieval | ✅ done |
| 4. Chat | 🚧 answer engine and streaming API done, UI pending |
| 5. Widget | — |
| 6. Conversations, gaps, leads | — |
| 7. Billing | — |
| 8. Answer quality | — |
| 9. Landing page | ✅ done |
| 10. Polish | — |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Clerk · Supabase Postgres +
pgvector · Drizzle · TanStack Query · OpenAI · Stripe

## Getting started

You need Node.js 22+, a Supabase project, a Clerk application and an OpenAI key.

### 1. Supabase

1. Create a project.
2. **Database → Extensions** → enable `vector` (the migration also enables it, but this is safer).
3. **Storage → New bucket** → `knowledge-sources`, private.
4. **Connect** (top bar) → **Session pooler** → copy the URI into `DATABASE_URL`, replacing
   `[YOUR-PASSWORD]` with the database password.
5. **Settings → API Keys** → project URL into `NEXT_PUBLIC_SUPABASE_URL`, the publishable key into
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the secret key into `SUPABASE_SERVICE_ROLE_KEY`.

Take the session pooler, not the direct connection: `db.<ref>.supabase.co` resolves over IPv6 only,
so on an IPv4-only network it fails with no error at all — `db:migrate` simply hangs. The pooler
host contains `pooler.supabase.com` and its user is `postgres.<ref>` rather than `postgres`. Keep
port 5432; the transaction pooler on 6543 cannot run migrations.

Projects created after the API key rotation reject the legacy `anon` / `service_role` JWTs even
though the dashboard still lists them, and Storage answers `JWS Protected Header is invalid`. Use
the `sb_publishable_…` / `sb_secret_…` pair instead — the variable names stay as they are.

### 2. The app

```bash
cd web
npm install
cp .env.example .env.local   # fill in your keys
npm run db:migrate
npm run dev
```

Runs on [http://localhost:3000](http://localhost:3000).

## Layout

```
web/
├── app/
│   ├── (marketing)/       # landing page, pricing
│   ├── (app)/             # signed-in dashboard
│   ├── embed/             # widget UI, served into an iframe
│   └── api/               # HTTP boundary
├── components/            # UI
├── lib/                   # shared contracts, plan catalogue
├── server/                # domain layer
│   ├── auth/              # account resolution
│   ├── db/                # schema and connection
│   ├── repositories/      # database access
│   └── services/          # business logic
├── drizzle/               # migrations
└── public/widget.js       # the embeddable loader
```

`app/*` is the HTTP boundary only, `server/services/*` holds the logic, and
`server/repositories/*` is the only place that queries the database.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Provider contract tests against the stub — no network, no keys |
| `npm run test:live` | The same tests against the real OpenAI API, using `.env.local` |
| `npm run verify` | lint + typecheck + test + build — the gate before every commit |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:migrate` | Apply migrations |

## Architecture notes

**Data isolation.** A bot can only be loaded together with its account
(`botRepository.findOwned`) — the ownership check is part of the query, so it cannot be forgotten.
Someone else's bot and a missing bot both return 404, because the status code must not reveal that
another account's resource exists. Vector search always carries `WHERE bot_id`: knowledge leaking
between bots is the worst failure this product has.

**Accounts are created lazily** on a signed-in user's first request. There is deliberately no Clerk
`user.created` webhook — it would add a failure mode (a missed delivery leaves a user with no
account) without buying anything.

**RLS is enabled with no policies.** The app connects directly over `DATABASE_URL` as the owning
role, which bypasses RLS. No policies exist so that Supabase's public anon key cannot read these
tables through PostgREST.

**Plan limits live in one place**, `lib/plans.ts`, and the client never sees a Stripe price id: it
asks to subscribe to a plan and an interval, and the server resolves the price.
