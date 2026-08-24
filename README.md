# Docsy — embeddable chatbot builder

Upload your company docs and get a chatbot that answers questions about them — inside the app, and
as a widget you embed on your own site.

Answers cite the document they came from, and the bot says "I don't know" instead of inventing.
When it cannot answer, it offers to take the visitor's contact details, and the unanswered question
shows up in the dashboard as a gap in your documentation.

## Status

Feature-complete. Every phase below is merged and verified against a live database, a live OpenAI
key and Stripe test mode.

| Phase | State |
| --- | --- |
| 0. Bootstrap | ✅ done |
| 1. Accounts and bots | ✅ done |
| 2. Knowledge sources and indexing | ✅ done |
| 3. Retrieval | ✅ done |
| 4. Chat | ✅ done |
| 5. Widget | ✅ done |
| 6. Conversations, gaps, leads | ✅ done |
| 7. Billing | ✅ done |
| 8. Answer quality | ✅ done |
| 9. Landing page | ✅ done |
| 10. Polish, seed data, demo | ✅ done |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Clerk · Supabase Postgres +
pgvector · Drizzle · TanStack Query · OpenAI · Stripe

---

## Getting started

Ten minutes, most of it spent creating accounts. You need Node.js 22+, plus a Supabase project, a
Clerk application and an OpenAI key. Stripe is only needed for the billing screens.

### 1. Supabase

1. Create a project.
2. **Database → Extensions** → enable `vector` (the migration also enables it, but this is safer).
3. **Storage → New bucket** → `knowledge-sources`, private.
4. **Connect** (top bar) → **Session pooler** → copy the URI into `DATABASE_URL`, replacing
   `[YOUR-PASSWORD]` with the database password. For a deployed environment take the **Transaction
   pooler** URI instead — see the note below.
5. **Settings → API Keys** → project URL into `NEXT_PUBLIC_SUPABASE_URL`, the publishable key into
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the secret key into `SUPABASE_SERVICE_ROLE_KEY`.

Take a pooler, not the direct connection: `db.<ref>.supabase.co` resolves over IPv6 only, so on an
IPv4-only network it fails with no error at all — `db:migrate` simply hangs. The pooler host
contains `pooler.supabase.com` and its user is `postgres.<ref>` rather than `postgres`.

**Which pooler port depends on where the app runs.** Locally one process holds a handful of
connections for as long as it lives, so the session pooler on **5432** is right, and it is also the
only port `db:migrate` works over. A deployed serverless environment is the opposite case: Vercel
freezes an instance instead of killing it, its socket outlives the request, and the session pooler
pins one of its fifteen server connections to that socket until it dies — after a few warm
instances every database route answers 500 with `EMAXCONNSESSION`. Deployments therefore need the
**transaction pooler on 6543** in `DATABASE_URL`, and `MIGRATIONS_DATABASE_URL` set to the 5432 URL
if migrations are ever run from there.

Projects created after the API key rotation reject the legacy `anon` / `service_role` JWTs even
though the dashboard still lists them, and Storage answers `JWS Protected Header is invalid`. Use
the `sb_publishable_…` / `sb_secret_…` pair instead — the variable names stay as they are.

### 2. Clerk

Create an application, take the **publishable key** and the **secret key** from **API keys**, and
enable email + password as a sign-in method. Nothing else needs configuring — accounts are created
in this app's own database on a user's first signed-in request.

### 3. OpenAI

Any key with access to `gpt-4o-mini` and `text-embedding-3-small`. Seeding the demo costs a
fraction of a cent.

### 4. Run it

```bash
cd web
npm install
cp .env.example .env.local   # fill in your keys
npm run db:migrate
npm run seed
npm run dev
```

`npm run seed` prints the sign-in it created. Open
[http://localhost:3000](http://localhost:3000), sign in with it, and the dashboard already has a
bot, a knowledge base, eight conversations, two content gaps and a captured lead.

Prefer to start from nothing? Skip `npm run seed`, sign up in the app, and create your own bot.

---

## The demo, in nine steps

Everything the product does, in five or six minutes. Run `npm run seed` first.

1. **Landing page** at `/` — scroll it, and ask the demo widget in the corner a question about the
   product itself.
2. **Sign in** with the credentials the seed printed.
3. **Knowledge** — upload `web/scripts/demo-assets/harbor-coffee-brewing-guide.md` and add a URL.
   Both index in front of you, and the character meter moves.
4. **Playground** — ask *"How much does UK delivery cost?"*. The answer streams, and the `[1]`
   marker under it links to the document it came from.
5. Ask *"Do you have a shop in Berlin?"* — nothing in the docs covers it, so the bot says so
   instead of inventing an address, and the widget offers to take an email.
6. **Appearance** — change the accent colour and watch the preview follow.
7. **Install** — add `localhost` to the allowed domains, copy the snippet into a file, and serve it
   over HTTP on any port:

   ```bash
   mkdir -p /tmp/demo && cd /tmp/demo
   printf '<!doctype html><title>Harbor Coffee</title><h1>Harbor Coffee Roasters</h1>' > demo.html
   # paste the snippet from the Install tab at the end of demo.html
   python3 -m http.server 4000
   ```

   Open <http://localhost:4000/demo.html> — the widget is live on a page this app does not serve.
   Ask it something. Opening `demo.html` straight from disk does *not* work, and should not: a
   `file://` page sends no domain, so the allowlist refuses it.
8. **Conversations → Content gaps** — the question from step 5 is waiting. **Answer this** turns it
   into an FAQ in one click; ask it again in the widget and it now answers, with a citation.
9. **Billing** — the plan, the credit meter and the three tiers. To see the other side of the
   gate, seed a Free account that has run out:

   ```bash
   npm run seed -- --plan=free --credits-used=100 --email=free@example.com
   ```

   Its widget stops answering and starts collecting contacts, the gaps list is locked behind a
   counter, and every upgrade path lands on `/billing` with the reason spelled out.

### Stripe (optional)

Checkout, the Billing Portal and the plan webhooks need Stripe test mode: the four price ids in
`.env.example`, and the CLI forwarding events at the app.

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Put the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`, then pay with `4242 4242 4242 4242` and
any future expiry. The plan is raised by the webhook, not by the redirect back.

Plan changes happen in the Billing Portal, and a Portal only offers them if its configuration lists
the products to switch between — the default one does not, so an account sent there to upgrade finds
nothing to upgrade with. The app creates and reuses its own configuration from the four price ids,
keyed by them, so replacing a price produces a fresh configuration rather than leaving customers on
one that offers prices you no longer sell. Nothing needs setting up in the Portal section of the
dashboard.

If Stripe rejects that configuration it usually wants the business links first — set a privacy
policy and terms of service URL under **Settings → Business → Public details**. The app logs the
refusal and falls back to the default Portal rather than taking away the only way to cancel, so the
symptom is a Portal that can cancel but not switch plan: check the server log for
`could not resolve a Portal configuration` if that is what you see.

A deployed endpoint must send these six events — `stripe listen` forwards everything, so the gap
only shows up in production:

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

`customer.subscription.updated` is the one worth checking twice: cancelling happens in the Billing
Portal, and that event carries `cancel_at_period_end`. Without it the billing page keeps offering a
renewal that is not coming. Returning from the Portal also reconciles directly against Stripe
(`POST /api/billing/sync`), so the screen is right either way — but the webhook is what keeps it
right for everyone who never opens the page.

**The amounts in Stripe are not checked against `lib/plans.ts` at runtime.** The pricing table comes
from the catalogue and the charge comes from the `STRIPE_PRICE_*` id, so a price created in the
dashboard at the wrong amount advertises $29 and bills something else, silently. `npm run test:live`
compares every configured price against the catalogue and fails on a mismatch — run it after
creating or replacing a price.

---

## Layout

```
web/
├── app/
│   ├── (marketing)/       # landing page
│   ├── (app)/             # signed-in dashboard
│   ├── embed/             # widget UI, served into an iframe
│   └── api/               # HTTP boundary
├── components/            # UI
├── lib/                   # shared contracts, plan catalogue
├── scripts/               # seed script and its demo assets
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
| `npm run seed` | Creates the demo account, bot, knowledge base and traffic. Safe to re-run |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen && tsc --noEmit` — typegen writes the generated `next-env.d.ts`, which is not in version control |
| `npm test` | Unit tests under `server/` and `components/`, including the provider contract against the stub — no network, no keys |
| `npm run test:live` | The same tests against the real OpenAI API, using `.env.local` |
| `npm run verify` | lint + typecheck + test + build — the gate before every commit |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:migrate` | Apply migrations |

`npm run seed` takes `--plan=free|pro|business`, `--email=…`, `--password=…` and
`--credits-used=N`. It rebuilds its own demo bot and leaves everything else in the account alone.

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

**The widget's protection is the domain allowlist**, not the public key. The key is meant to be
visible in the page source; what stops someone reusing it is that the panel only renders for a page
whose hostname is on the bot's list. That is checked on the iframe's own navigation, using the
`Referer` the browser sets to the embedding page — the widget's later API calls are made from inside
that iframe, so their `Origin` is this app and says nothing about where the visitor is. A bot with an
empty list allows nothing.

**Plan limits live in one place**, `lib/plans.ts`, and the client never sees a Stripe price id: it
asks to subscribe to a plan and an interval, and the server resolves the price.

**Retrieval is relative, not absolute.** No fixed similarity threshold separated signal from noise
in measurement, so the best hit is kept whenever it clears a low floor and runners-up are kept
within a margin of it. The model, not the retriever, makes the final call on whether the context
answers the question.
