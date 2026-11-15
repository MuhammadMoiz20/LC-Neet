@AGENTS.md

# Deployment: Vercel

Production runs on Vercel: **https://lc-neet.vercel.app** (project `lc-neet`).

- Deploy: `vercel deploy --prod` (or push to `main` if the Git integration is on).
- Package manager: **npm**. There is no pnpm lockfile; don't reintroduce one.

## Database: Turso (libSQL)

Vercel's filesystem is read-only and ephemeral, so there is no local SQLite file
in production. `lib/db.ts` opens a remote Turso database when
`TURSO_DATABASE_URL` is set, and a local `data/app.db` otherwise (dev + tests).

The driver is `libsql`, an API-compatible fork of `better-sqlite3` — call sites
stay synchronous. One quirk: libsql's `.get()` adds a `_metadata` key that
`getDb()` strips centrally, so no query code has to handle it.

Note Turso **enforces foreign keys** where the old local file did not. Rows whose
parents were deleted will be rejected; `scripts/push-to-turso.ts` skips and
reports them.

## Environment variables (set in Vercel, Production)

| Var | Purpose |
| --- | --- |
| `AUTH_SECRET` | NextAuth signing key |
| `AUTH_URL` | `https://lc-neet.vercel.app` |
| `TURSO_DATABASE_URL` | `libsql://lc-neet-moiz20.aws-us-east-1.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso write token |
| `OPENROUTER_API_KEY` | LLM access |
| `OPENROUTER_MODEL` | Optional; defaults to `~deepseek/deepseek-v4-flash-latest` |

Env var changes only take effect on the **next deploy**.

## LLM: OpenRouter

`lib/llm/openrouter.ts` is a small OpenAI-compatible client (plain `fetch`)
providing `streamChat()` (SSE + a bounded tool-call loop, used by the coach) and
`completeChat()` (used by the analysis pipeline). The default model id
`~deepseek/deepseek-v4-flash-latest` genuinely starts with `~` — that is
OpenRouter's id, not a typo.

## Scripts

- `npm run push:turso` — copy a local SQLite file into Turso (`LOCAL_DB_PATH` to
  pick the source; defaults to `data/app.db`). Safe to re-run; uses INSERT OR IGNORE.
- `npm run set-password -- <email> <password>` — reset a user's password against
  whichever database `getDb()` resolves to.

## History

This app previously ran on a Mac Studio (`mac-studio`, port 3100) under launchd
agents `com.lcneet.{app,health,logrotate}`. That deployment was retired on
2026-08-19; the checkout, database, and agents were removed. A snapshot of its
database and its local auth-disabling patch are in `backups/` on Moiz's laptop
(gitignored). A separate Math-Tutor app still runs on that machine on port 8723.

## Checks and local runs

- `npm run check` — typecheck + lint + unit tests (`tsc --noEmit`, `eslint`, `vitest run`).
- `npx playwright test` — starts its own dev server on port 3210 against its own
  database `data/e2e.db` (see `playwright.config.ts`). It never reuses a running server.
- **WARNING:** `.env.local` (from `vercel env pull`) contains the production
  `TURSO_DATABASE_URL`, so a plain `npm run dev` reads and writes production
  data. The local override is: `TURSO_DATABASE_URL=data/app.db npm run dev`
- Unit tests never touch `data/app.db`: `getDb()` with no argument reuses the
  connection a test already opened (`lib/db.ts`).

## State machines

| Machine | File | States and transitions |
| --- | --- | --- |
| Python runner | `lib/pyodide/use-pyodide-runner.ts` | `loading → ready ⇄ running`; `cancel()` from any state terminates the worker and respawns (`→ loading`); worker crash or failed load `→ error`. A run queued while loading goes `loading → running`. |
| Workspace activity | `app/(app)/problem/[slug]/problem-workspace.tsx` | `activity`: `null → run \| submit \| custom → null`. One at a time; nothing starts unless `activity === null` and the runner is ready. |
| Interview session | same file | `active → expired` when the timer hits zero; the final attempt is auto-submitted once (waits for an in-flight run or a reloading runner). |
| Analysis, client | `lib/analysis/use-analysis.ts` | `loading → running → settled`; `running → stalled` after 150 polls (2s each, the server's 300s budget); `rerun()` takes `settled`/`stalled` back to `running`. Polling only happens in `running`. |
| Analysis, server rows | `lib/analysis/pipeline.ts`, `app/api/analysis/[attemptId]/route.ts` | Per kind: `(no row) → pending → done \| error`. POST starts it; starting is a no-op once rows exist, `?force=1` resets every kind to `pending`. The LLM calls run in `after()`. |
| Coach reply | `components/coach-panel.tsx` | `idle → streaming → idle`. A failure ends the same way, with the reason appended to the reply bubble. Sending is blocked while streaming. |
| Login | `app/login/page.tsx` | `idle → submitting → (redirect) \| error → submitting …` |
| Problem lifecycle | `lib/lifecycle/stage.ts` | Derived, never stored. First match wins: review due or `interval_days <= 1` → `revisit`; no attempt → `todo`; not accepted → `attempting`; `interval_days >= 21` → `mastered`; else `solved`. "Due" means due by the end of the user's day (`endOfLocalDay`). `lib/lifecycle/board.ts` additionally requires accepted passes on 3 separate days for `mastered`, and `submitAttempt` only advances the schedule when the review is due. The only manual transition is "Revisit soon" (`markRevisit` sets `interval_days = 1`, due tomorrow). |

- `lcn:toggle-coach` / `lcn:toggle-analysis`: cancelable window events the app shell (`components/app-shell/app-shell.tsx`, for the command palette) dispatches; the workspace cancels one when it toggles its panel, so an un-cancelled event means "no panel on this page" and the shell shows a toast.
- `tz` cookie: the app shell stores the browser's UTC offset (minutes east of UTC); `lib/time/local-day.ts` reads it so "today", streaks and the heatmap follow the user's clock, falling back to the server's offset.
- `lcn-draft-<slug>`: the per-problem code draft in localStorage, restored on return. Interview rounds don't read or write it.
