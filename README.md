# Embeddable Chatbot Builder

Upload your company docs and get a chatbot that answers questions about them — inside the app and
as a widget you embed on your own site.

- **Product spec** — [PROJECT_SPEC.md](PROJECT_SPEC.md)
- **Development plan** — [DEV_PLAN.md](DEV_PLAN.md)
- **Billing flows and edge cases** — [payments-and-subscriptions.md](payments-and-subscriptions.md)
- **How this repo is worked on** — [CLAUDE.md](CLAUDE.md)

## Status

| Phase | State |
| --- | --- |
| 0. Bootstrap | — |
| 1. Accounts and bots | — |
| 2. Knowledge sources and indexing | — |
| 3. Retrieval | — |
| 4. Chat | — |
| 5. Widget | — |
| 6. Conversations, gaps, leads | — |
| 7. Billing | — |
| 8. Answer quality | — |
| 9. Landing page | — |
| 10. Polish | — |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Clerk · Supabase Postgres +
pgvector · Drizzle · TanStack Query · OpenAI · Stripe (phase 7)

## Getting started

You need Node.js 22+, a Supabase project, a Clerk application and an OpenAI key.

### 1. Supabase

1. Create a project.
2. **Database → Extensions** → enable `vector` (the migration also enables it, but this is safer).
3. **Storage → New bucket** → `knowledge-sources`, private.
4. **Settings → Database → Connection string (URI)** → put it in `DATABASE_URL`.

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
.
├── .github/workflows/ci.yml   # lint + typecheck + build
├── CLAUDE.md                  # working agreement
├── PROJECT_SPEC.md            # what we build and why
├── DEV_PLAN.md                # order of work
└── web/
    ├── app/
    │   ├── (marketing)/       # landing page, pricing
    │   ├── (app)/             # signed-in dashboard
    │   └── api/               # HTTP boundary
    ├── components/            # UI
    ├── lib/                   # shared contracts and helpers
    ├── server/                # domain layer
    │   ├── auth/              # account resolution
    │   ├── db/                # schema and connection
    │   ├── repositories/      # database access
    │   └── services/          # business logic
    └── drizzle/               # migrations
```

`app/*` is HTTP only, `server/services/*` holds logic, `server/repositories/*` is the only place
that queries the database.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | lint + typecheck + build — the gate before every commit |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:migrate` | Apply migrations |

## Architecture notes

**Data isolation.** A bot can only be loaded together with its account
(`botRepository.findOwned`) — the ownership check is part of the query, so it cannot be forgotten.
Someone else's bot and a missing bot both return 404.

**Accounts are created lazily** on a signed-in user's first request. There is deliberately no
Clerk `user.created` webhook: it would add a failure mode without buying anything.

**RLS is enabled with no policies.** The app connects directly over `DATABASE_URL` as the owning
role, which bypasses RLS. No policies exist so that Supabase's public anon key cannot read these
tables through PostgREST.
