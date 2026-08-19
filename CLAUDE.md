# Working agreement

This project is built **autonomously**. Yana is the reviewer, not a collaborator on the
implementation. Optimise every decision for "she opens a PR and can approve it without asking
questions", not for "she tells me what to do next".

Read this file, `PROJECT_SPEC.md` (what and why) and `DEV_PLAN.md` (order of work) before starting
a phase.

---

## 1. The loop

One phase from `DEV_PLAN.md` = one branch = one PR. Never anything else.

```
1. git checkout -b feat/phase-<N>-<slug>      # base: see §2
2. implement the whole phase
3. npm run verify                             # must be green, no exceptions
4. git commit                                 # see §5 for the message
5. git push -u origin <branch>
6. gh pr create                               # see §6 for the body
7. STOP. Report the PR link and what needs attention.
```

**Never merge a PR. Never push to `main`.** Merging is the reviewer's only job — taking it away
makes the review meaningless.

Do not start the next phase in the same turn as opening a PR. The review may change things.

## 2. Branch base

- Previous phase **merged** → branch from `main`.
- Previous phase **still open** → branch from that branch, and target the PR at it
  (`gh pr create --base feat/phase-<N-1>-<slug>`). GitHub re-targets the child PR to `main`
  automatically once the parent merges. This keeps each diff reviewable on its own.

Say in the PR body which PR it stacks on.

## 3. When to ask, when to decide

**Decide alone.** Naming, file layout, component structure, libraries within the agreed stack, copy,
error messages, ordering inside a phase, schema details, trade-offs already covered by the spec.
If two readings of the spec are both defensible, pick one, implement it, and note the choice in the
PR body. A question that costs the reviewer more time than a wrong-but-reversible choice is a bad
question.

**Ask** only for:
- credentials and access that cannot be obtained without her (DB URLs, API keys, Stripe account);
- actions outside this repo that are hard to undo (creating/renaming/deleting repos, making the
  repo public, anything that spends money);
- a change that contradicts `PROJECT_SPEC.md` — propose it, do not silently deviate.

Everything else: proceed and report afterwards.

**Settled, never ask again:** GitHub account `ykapylova`, repo private, default branch `main`,
phase-per-PR workflow.

## 4. Blocked mid-phase

Do not stall and do not park the whole phase.

1. Finish every part that does not depend on the blocker.
2. Commit and open the PR anyway, marked `[blocked]` in the title.
3. State the blocker at the top of the PR body: what is needed, from whom, in one sentence.
4. Repeat it in the chat reply.

Example already hit: migrations could not run because `DATABASE_URL` still pointed at the old
Supabase project. Correct behaviour was to ship everything else and name the blocker — not to wait.

## 5. Commits

Conventional-commit subject, body explaining why rather than restating the diff.

```
feat(bots): add knowledge source ingestion

Парсинг PDF/TXT/MD, чанкинг и эмбеддинги с машиной статусов.
Индексация идёт по одному источнику за запрос, maxDuration = 60.
```

Scopes: `bots`, `sources`, `chat`, `widget`, `billing`, `landing`, `db`, `ci`, `docs`.

**No trailers.** No `Co-Authored-By`, no generated-with footers — in commits or in PR bodies.
This is Yana's work; the authorship line is hers alone.

One commit per phase is fine. Split only when the phase genuinely contains unrelated changes.

## 6. Pull requests

Title: `Phase <N>: <name from DEV_PLAN>`. Body in this shape:

```markdown
## What changed
A short list of substance, not a retelling of the diff.

## How to verify
Numbered steps that actually reproduce locally.

## Decisions
Forks I closed on my own and why. Deviations from the spec go here too.

## Left open
Debts and anything deliberately deferred to a later phase.
```

Add `## Blocker` at the very top when the PR is `[blocked]`.

No screenshots of things the reviewer can see by running `npm run dev`; do include them for
visual work where the wording of a screen matters.

## 7. Verification gate

`npm run verify` (lint + typecheck + build) must pass **before** every commit. A red gate is never
"fixed in the next PR".

Beyond the gate, check by hand what CI cannot:
- the happy path of the phase actually works in `npm run dev`;
- empty, loading and error state for every screen the phase adds;
- mobile width for anything user-facing;
- the phase's "Готово, когда" line in `DEV_PLAN.md` is literally true.

Never report a phase done on a hope. If something is unverified, say so.

## 8. Keeping documents true

Update in the same PR as the code:
- `README.md` — phase status table, new env vars, new setup steps;
- `web/.env.example` — every new variable, with a comment;
- `DEV_PLAN.md` — only if the plan actually changed; note why.

`PROJECT_SPEC.md` is the contract. Changing it needs a sentence of justification in the PR body.

## 9. Code conventions

**Layers.** `app/*` is HTTP only — parse, call a service, map the result. `server/services/*` holds
logic. `server/repositories/*` is the only place with database queries. Components never touch the
database, server components included.

**Ownership lives in the query.** Resources are fetched as `findOwned(id, accountId)`, never fetched
then checked. Missing and not-yours return the same 404 — the response must not reveal that someone
else's resource exists.

**Vector search always carries `WHERE bot_id`.** Knowledge leaking between bots is the worst bug
this product can have.

**Validation.** Every write endpoint parses its body with Zod. `ZodError` → 422 with the first
issue's message. Invalid JSON → 400.

**Plan limits live once**, in `PLAN_LIMITS`. A limit duplicated in a component is a bug.

**No `if (isStub)` in business logic.** Provider selection happens once, behind `AnswerProvider`.

**Every screen has three states**: empty, loading, error — with a way out of the error.

**Language: English, everywhere in the repository.** Identifiers, UI copy, code comments, all
markdown documents, commit messages and PR descriptions. No exceptions — a half-translated repo
reads as unfinished. (Chat replies to Yana stay in Russian; that is conversation, not the product.)

**Comments explain why, not what.** No comment is better than a comment restating the code.

## 10. Secrets

`.env.local` is never committed, never printed in full, never pasted into a PR. New variables go to
`.env.example` with a placeholder. Client-side code gets `pk_*` and public URLs only; `sk_*`,
`whsec_*` and service-role keys stay on the server.

Before every commit, confirm the staged file list has no `.env*` beyond `.env.example`.

## 11. Parallel tracks

Some phases are independent and can run as separate agents at the same time. The main session is the
hub: it briefs the tracks, integrates them, resolves conflicts and reports to Yana. Tracks never talk
to each other.

**Every parallel track runs in its own git worktree** (`isolation: "worktree"`), on its own branch,
and opens its own PR. No two tracks share a working tree.

**Territory is assigned, not negotiated.** A track edits only files inside its territory. Anything
shared is the hub's to change:

| Shared file | Owner |
| --- | --- |
| `web/server/db/schema.ts` and `web/drizzle/**` | hub only — one migration author at a time |
| `README.md` status table | hub |
| `web/.env.example` | hub (tracks report new variables in the PR body instead) |
| `web/package.json` | hub (tracks list needed dependencies in the PR body) |
| `CLAUDE.md`, `PROJECT_SPEC.md`, `DEV_PLAN.md` | hub |

If a track needs something outside its territory, it says so in its PR and does not reach for it.
Two agents editing one file produces conflicts that cost more than the parallelism saved.

**Briefing a track** must include: which phase from `DEV_PLAN.md`, its territory, its branch name,
the blockers it will hit, and an instruction to read `CLAUDE.md` and `PROJECT_SPEC.md` first. A cold
agent that guesses the conventions writes code that has to be rewritten.

**Fan-out width follows the reviewer, not the machine.** Yana reviews every PR alone. Three parallel
PRs mean three simultaneous reviews. Do not open more tracks than she has said she can absorb.

## 12. Reporting back

The chat reply after a PR is short and factual:
- PR link;
- what changed, in a few lines;
- decisions the reviewer might disagree with;
- anything unverified or blocked.

No re-listing of the diff. No progress theatre.
