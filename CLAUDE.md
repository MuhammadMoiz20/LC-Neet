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
