# Step 4: AI Coach (Socratic + Hints) — Design

**Date:** 2026-04-26
**Owner:** Moiz
**Status:** Approved

## Goal

Wire the Anthropic Agent SDK into a streaming chat panel on the problem page, with two coaching modes (Socratic, Hints), two read-only tools, and a runtime guard against full-solution leaks.

## Non-Goals

- Style mode auto-trigger on save (Step 5)
- Post-submission analysis pipeline (Step 5)
- LLM-judge eval suite (later)
- Round-trip `run_tests` tool — coach instead receives the last test-run output as per-turn context
- Mid-stream resume on refresh

## Architecture

```
Browser (CoachPanel client, drawer on /problem/[slug])
  └─ fetch POST /api/coach (streaming response, ReadableStream)
       └─ Route handler
            ├─ saves user message → chat_messages
            ├─ calls lib/agent/stream.ts
            │    └─ @anthropic-ai/claude-agent-sdk (Claude Max OAuth)
            │         └─ tools: get_problem_meta, get_user_history (SQLite-backed)
            ├─ pipes deltas through filter (looksLikeFullSolution)
            │    → if triggered: abort + emit safe-message event
            └─ on stream end: saves assistant message → chat_messages
```

## Components

- `lib/agent/stream.ts` — `streamCoach({mode, problemId, userId, code, lastRunOutput, history, userMessage})` → async iterable of `{type: "delta"|"blocked"|"done", text?}`
- `lib/agent/tools.ts` — Agent SDK tool definitions + handlers (read SQLite)
- `lib/agent/prompts.ts` — system prompts per mode, embedding the no-solution rule
- `lib/agent/filter.ts` — `looksLikeFullSolution(text): boolean` heuristic
- `lib/chat/repo.ts` — `saveMessage`, `listMessages(userId, problemId)`
- `app/api/coach/route.ts` — POST (stream) + GET (history)
- `components/coach-panel.tsx` — client drawer, mode dropdown, message list, input, markdown render
- DB migration: `chat_messages(id, user_id, problem_id, role, content, mode, created_at)` added to `lib/db.ts` schema

## Modes

- **Socratic** — system prompt instructs the model to respond only with questions that surface insight; never propose code; one question at a time.
- **Hints** — progressive ladder; level escalates on each follow-up in same conversation; pseudocode allowed up to 3 lines per the original design doc.

## Tools (read-only, server-side, SQLite-backed)

- `get_problem_meta(problemId)` → `{title, difficulty, topic, description_excerpt}`
- `get_user_history(topic, limit)` → recent attempts in that topic (slug, status, created_at)

## Safety

- System prompts restate the no-full-solution rule per mode.
- `looksLikeFullSolution` heuristic flags two patterns in the assistant's running buffer:
  - `class Solution` containing a method with body >3 non-trivial lines
  - top-level `def` with >3 non-trivial lines
- On hit, server aborts the SDK stream and emits a single `blocked` event with a safe message; the persisted assistant message records the safe message, not the partial leak.
- Vitest covers the filter deterministically.

## Data Model

New table:

```sql
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  problem_id INTEGER NOT NULL,
  role TEXT NOT NULL,        -- 'user' | 'assistant'
  content TEXT NOT NULL,
  mode TEXT NOT NULL,        -- 'socratic' | 'hints'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (problem_id) REFERENCES problems(id)
);
CREATE INDEX idx_chat_user_problem ON chat_messages(user_id, problem_id, created_at);
```

## Auth & SDK

- `@anthropic-ai/claude-agent-sdk`. Uses Claude Max OAuth so no per-call API key is consumed.
- Server-only — never expose tokens to the client.

## Streaming Transport

- POST returns `text/event-stream`. Client uses `fetch` + `ReadableStream` reader (EventSource is GET-only).
- Event shape: `data: {"type":"delta","text":"..."}\n\n` plus terminal `done` or `blocked` event.

## Persistence Timing

- User message saved before SDK call (so it survives a stream error).
- Assistant message saved exactly once on stream end (full text, post-filter).

## Testing

- **Vitest**
  - `lib/agent/filter.test.ts` — positive (full solution shapes) + negative (pseudocode, prose) cases
  - `lib/chat/repo.test.ts` — save + list ordering
  - `lib/agent/stream.test.ts` — SDK mocked; verifies prompt selection, tool registration, history-injection, filter abort path
- **Playwright** (`tests/e2e/coach.spec.ts`)
  - Open `/problem/two-sum`, toggle drawer, send a hint request, see a streamed reply, refresh page, see history reload.
  - Skipped if no `ANTHROPIC_API_KEY` / OAuth env present.

## Build Order (preview)

1. DB migration + chat repo (TDD)
2. Filter heuristic (TDD)
3. Agent SDK install + tools + prompts + stream wrapper (with mocked SDK tests)
4. `/api/coach` route (POST stream, GET history)
5. `CoachPanel` client component + drawer toggle on problem page
6. E2E + final verify
