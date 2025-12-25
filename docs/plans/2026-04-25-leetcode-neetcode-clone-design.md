# LeetCode Clone (NeetCode 150) with AI Coach — Design

**Date:** 2026-04-25
**Owner:** Moiz
**Status:** Approved

## Goal

A personal, single-user LeetCode clone covering the NeetCode 150 problems, with LeetCode-Premium-equivalent features and an Anthropic-Agent-SDK-powered AI coach that teaches and reviews code style without giving away solutions. Hosted from the user's Mac and exposed via Cloudflare Tunnel so it's reachable from any device.

## Constraints

- Single user (Moiz), but accessible from any device on the public internet
- Python only for code execution (for now)
- Must use Anthropic Agent SDK so the Claude Max subscription provides the LLM
- AI must never produce a runnable full solution, even when asked

## Architecture

Single Next.js app running on the user's Mac, exposed via Cloudflare Tunnel.

```
[Browser anywhere] → Cloudflare Tunnel → Next.js (localhost:3000)
                                          ├─ React UI (Monaco editor, Pyodide worker)
                                          ├─ API routes (problems, progress, chat, analysis)
                                          ├─ Anthropic Agent SDK (uses Max OAuth)
                                          └─ SQLite (better-sqlite3, file on disk)
```

- **Frontend:** Next.js (App Router) + Tailwind + shadcn/ui + Monaco editor
- **Code execution:** Pyodide in a Web Worker (off main thread)
- **Backend:** Next.js API routes; no separate service
- **AI:** Anthropic Agent SDK invoked from API routes, streaming responses to UI
- **Storage:** SQLite (`data/app.db`), nightly backup to iCloud Drive folder
- **Hosting:** Local Mac + Cloudflare Tunnel (`lc.<domain>`)
- **Auth:** Single password via NextAuth credentials provider; rate-limited

**Trade-off accepted:** when the Mac is asleep/off, the site is down. `caffeinate` / "prevent sleep on power" mitigates.

## Components

**Pages**
- `/` dashboard: streak, weekly summary, weak topics, suggested next problem
- `/problems` NeetCode 150 list with filters (topic, difficulty, status, last attempted)
- `/problem/[slug]` split pane: description | editor + test runner + AI chat tab
- `/analysis/[attemptId]` post-submission deep dive
- `/stats` progress analytics, mistake patterns, spaced-repetition queue
- `/interview` mock interview mode

**Core modules**
- `lib/pyodide-runner.ts` — Web Worker wrapper, runs solution + harness against test cases
- `lib/agent.ts` — Anthropic Agent SDK wrapper; one entry point per coach mode
- `lib/problems/` — NeetCode 150 data (markdown + test cases JSON), seeded into SQLite on first boot
- `lib/analysis/` — orchestrates analyses by composing agent calls + storing results

## Data Model (SQLite)

```
users(id, email, password_hash)
problems(id, slug, title, difficulty, topic, neetcode_video_url,
         description_md, starter_code, test_cases_json, editorial_md)
attempts(id, user_id, problem_id, code, status, runtime_ms, created_at, mode)
analyses(id, attempt_id, kind, content_md, created_at)
        -- kind: quality|complexity|comparison|pattern
chat_messages(id, attempt_id, role, content, mode, created_at)
mistakes(id, user_id, problem_id, category, note, created_at)
review_queue(id, user_id, problem_id, due_at, ease)  -- SM-2 lite
daily(id, user_id, date, problem_id, completed)
sessions(...)  -- NextAuth
```

## AI Coach Design

Mode selector in chat panel: **Socratic | Hints | Style | Analysis | Interview**.

- Hard system-prompt rule: never output runnable full solution code. Hints can include data-structure names, invariants, and pseudocode fragments (≤3 lines), but no full functions.
- Per-turn context: problem description, current code snapshot, last test run output, mode, recent chat.
- Streaming: Agent SDK streams tokens to UI via Server-Sent Events.
- Tool use: agent gets read-only tools — `run_tests(code)`, `get_problem_meta()`, `get_user_history(topic)` — to ground feedback in real data.
- Style mode: triggers automatically on save (debounced) with a non-intrusive sidebar critique.

## Analysis Pipeline (post-submission)

On accepted submission, fan out parallel agent calls:

1. **Quality** — style/naming/idiom review against PEP 8 + user's style memory
2. **Complexity** — derives time/space with reasoning trace
3. **Comparison** — compares against optimal approach for that problem
4. **Pattern** — tags pattern; updates pattern-mastery counters
5. **Mistake detector** — diffs against prior bugs to flag recurring issues

Results stored in `analyses`; viewable on `/analysis/[attemptId]`.

**Weekly summary** — Sunday-night cron route aggregates the week, writes a markdown digest, surfaces weak topics + spaced-repetition picks.

## Premium-Equivalent Features (in scope)

- Editorial / official solutions (AI-generated explanations)
- Embedded NeetCode YouTube videos per problem
- Custom test cases (user inputs)
- Problem of the day + streaks
- Topic-based study plans
- Personal frequency / acceptance stats

**Out of scope:** community discussion, company tags, full step debugger.

## Error Handling & Reliability

- Pyodide load failure → visible error + retry button (no silent failure)
- Agent SDK errors → surfaced in chat with retry; chat history preserved
- Tunnel down → app still works on `localhost`
- DB writes wrapped in transactions; nightly SQLite backup to iCloud folder
- Auth lockout after 5 failed attempts (it's on the public internet)

## Testing

- **Unit:** Pyodide test harness, SM-2 review scheduler, mistake categorizer
- **Integration:** API routes against a real SQLite test DB
- **E2E:** Playwright — submit a known-correct solution, verify analysis appears
- **Agent eval:** fixture set asserting the coach never emits full solutions (regex + LLM-judge)

## Build Order

1. Skeleton: Next.js + auth + SQLite + seed NeetCode 150 problems
2. Problem page + Monaco + Pyodide runner + test harness
3. Attempts persisted; basic dashboard
4. Agent SDK wired; Socratic + Hints modes; streaming chat
5. Post-submission analysis pipeline (quality + complexity)
6. Style mode + Comparison + Pattern + Mistake detection
7. Stats page + spaced repetition + daily problem + streak
8. Mock interview mode
9. Cloudflare Tunnel + custom domain
