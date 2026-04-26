# Step 5–6: Analysis Pipeline + Style Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** On every accepted submission, fan out 5 parallel Anthropic Agent SDK calls and persist them to a new `analyses` table; render a `/analysis/[attemptId]` page; add a manual "Style" mode to the existing `CoachPanel`.

**Architecture:** New `lib/analysis/pipeline.ts` orchestrator runs five `query()` calls via `Promise.allSettled`, wraps every output through the existing `looksLikeFullSolution` filter, upserts rows keyed by `(attempt_id, kind)`. New routes `POST/GET /api/analysis/[attemptId]`. New page polls every 2s while any row is `pending`. Style mode reuses `lib/agent/stream.ts` with a new prompt; mode union extended from `'socratic'|'hints'` to add `'style'`.

**Tech Stack:** Next.js 15 App Router, better-sqlite3, Vitest, Playwright, `@anthropic-ai/claude-agent-sdk`. All already installed.

**Commit policy:** Real-time `git commit` after each task.

**Reference docs:** `node_modules/next/dist/docs/` for Next 15 route handlers / dynamic params. Existing patterns in `lib/agent/stream.ts`, `lib/chat/repo.ts`, `app/api/coach/route.ts`.

---

### Task 1: `analyses`, `mistakes`, `pattern_counters` tables (TDD)

**Files:**
- Modify: `lib/db.ts`
- Create: `lib/analysis/repo.ts`, `lib/analysis/repo.test.ts`

**Step 1:** Append to `SCHEMA` in `lib/db.ts` (after the `chat_user_problem` index):

```sql
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  kind TEXT NOT NULL CHECK(kind IN ('quality','complexity','comparison','pattern','mistake')),
  content_md TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','done','error')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(attempt_id, kind)
);
CREATE INDEX IF NOT EXISTS analyses_attempt ON analyses(attempt_id);
CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  category TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS mistakes_user_problem ON mistakes(user_id, problem_id);
CREATE TABLE IF NOT EXISTS pattern_counters (
  user_id INTEGER NOT NULL REFERENCES users(id),
  pattern TEXT NOT NULL,
  solved_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, pattern)
);
```

**Step 2:** Write `lib/analysis/repo.test.ts` covering:
- `upsertAnalysis` inserts new row
- `upsertAnalysis` second call with same `(attempt_id, kind)` updates content + status
- `getByAttempt` returns rows in stable kind order
- `recordMistake` inserts and `listMistakesForUser` returns it
- `bumpPattern` increments; second call increments again

Use `vitest` + `__resetDbCache` + a temp-file DB (mirror `lib/chat/repo.test.ts`).

**Step 3:** Run: `npx vitest run lib/analysis/repo.test.ts` → expect FAIL (module missing).

**Step 4:** Implement `lib/analysis/repo.ts`:

```ts
import type Database from "better-sqlite3";

export type AnalysisKind =
  | "quality" | "complexity" | "comparison" | "pattern" | "mistake";
export type AnalysisStatus = "pending" | "done" | "error";

export type Analysis = {
  id: number;
  attempt_id: number;
  kind: AnalysisKind;
  content_md: string;
  status: AnalysisStatus;
  created_at: number;
};

const KIND_ORDER: AnalysisKind[] = [
  "quality", "complexity", "comparison", "pattern", "mistake",
];

export function upsertAnalysis(
  db: Database.Database,
  row: { attempt_id: number; kind: AnalysisKind; content_md: string; status: AnalysisStatus },
): void {
  db.prepare(
    `INSERT INTO analyses (attempt_id, kind, content_md, status)
     VALUES (@attempt_id, @kind, @content_md, @status)
     ON CONFLICT(attempt_id, kind) DO UPDATE SET
       content_md = excluded.content_md,
       status = excluded.status`,
  ).run(row);
}

export function getByAttempt(db: Database.Database, attemptId: number): Analysis[] {
  const rows = db.prepare(
    `SELECT id, attempt_id, kind, content_md, status, created_at
     FROM analyses WHERE attempt_id = ?`,
  ).all(attemptId) as Analysis[];
  rows.sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
  return rows;
}

export function recordMistake(
  db: Database.Database,
  m: { user_id: number; problem_id: number; attempt_id: number; category: string; note: string },
): number {
  const info = db.prepare(
    `INSERT INTO mistakes (user_id, problem_id, attempt_id, category, note)
     VALUES (@user_id, @problem_id, @attempt_id, @category, @note)`,
  ).run(m);
  return Number(info.lastInsertRowid);
}

export function listMistakesForUser(
  db: Database.Database,
  userId: number,
  limit = 50,
): { id: number; problem_id: number; category: string; note: string; created_at: number }[] {
  return db.prepare(
    `SELECT id, problem_id, category, note, created_at
     FROM mistakes WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ?`,
  ).all(userId, limit) as never;
}

export function bumpPattern(db: Database.Database, userId: number, pattern: string): void {
  db.prepare(
    `INSERT INTO pattern_counters (user_id, pattern, solved_count)
     VALUES (?, ?, 1)
     ON CONFLICT(user_id, pattern) DO UPDATE SET solved_count = solved_count + 1`,
  ).run(userId, pattern);
}

export function listPatternCounters(
  db: Database.Database,
  userId: number,
): { pattern: string; solved_count: number }[] {
  return db.prepare(
    `SELECT pattern, solved_count FROM pattern_counters WHERE user_id = ? ORDER BY solved_count DESC`,
  ).all(userId) as never;
}
```

**Step 5:** Run tests until green: `npx vitest run lib/analysis/repo.test.ts`.

**Step 6:** Commit:
```bash
git add lib/db.ts lib/analysis/repo.ts lib/analysis/repo.test.ts
git commit -m "feat: analyses, mistakes, pattern_counters tables + repo"
```

---

### Task 2: Per-kind system prompts

**Files:**
- Create: `lib/analysis/prompts.ts`, `lib/analysis/prompts.test.ts`

**Step 1:** Write the test asserting:
- `analysisPrompt('quality')` mentions "PEP 8" and "naming"
- `analysisPrompt('complexity')` mentions "Big-O" and asks for a brief reasoning trace
- `analysisPrompt('comparison')` asks to compare against the optimal approach
- `analysisPrompt('pattern')` asks for `Pattern: <single name>` on the first line (machine-readable)
- `analysisPrompt('mistake')` asks for `Category: <token>` on the first line and a short note (machine-readable)
- All prompts contain the same hard "no full solution" rule (re-export `NO_SOLUTION_RULE` from `lib/agent/prompts.ts` — refactor: move it to a shared module if needed, but only if Task 2 references it).

**Step 2:** `npx vitest run lib/analysis/prompts.test.ts` → FAIL.

**Step 3:** Implement `lib/analysis/prompts.ts`. Each prompt is a `string` constant + `analysisPrompt(kind)` exported. Keep prompts tight (≤180 words). Include the no-solution rule (inline copy is fine — duplication is acceptable here; no need to refactor the agent module).

The pattern + mistake prompts MUST instruct the model to begin its response with a single machine-readable header line (`Pattern: <name>` or `Category: <token>`) so we can parse for `bumpPattern` / `recordMistake` later.

**Step 4:** Tests green.

**Step 5:** Commit:
```bash
git add lib/analysis/prompts.ts lib/analysis/prompts.test.ts
git commit -m "feat: per-kind analysis prompts"
```

---

### Task 3: Single-kind analysis runner (TDD with mocked SDK)

**Files:**
- Create: `lib/analysis/run-one.ts`, `lib/analysis/run-one.test.ts`

**Step 1:** Test (mock `query` from `@anthropic-ai/claude-agent-sdk` via `vi.mock`):
- `runOne({kind:'quality', code, problem})` invokes `query` with the right system prompt
- Returns `{kind, content_md, status:'done'}` on success
- Returns `{status:'error'}` if the SDK throws
- If returned content trips `looksLikeFullSolution`, returns `{status:'error', content_md:'[blocked: full-solution leak]'}`

**Step 2:** `npx vitest run lib/analysis/run-one.test.ts` → FAIL.

**Step 3:** Implement:

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import { looksLikeFullSolution } from "@/lib/agent/filter";
import { analysisPrompt } from "./prompts";
import type { AnalysisKind, AnalysisStatus } from "./repo";

export type RunOneInput = {
  kind: AnalysisKind;
  code: string;
  problemTitle: string;
  problemTopic: string;
  problemDifficulty: string;
  problemDescription: string;
};

export type RunOneResult = {
  kind: AnalysisKind;
  content_md: string;
  status: AnalysisStatus;
};

export async function runOne(input: RunOneInput): Promise<RunOneResult> {
  const userPrompt = `Problem: ${input.problemTitle} (${input.problemDifficulty}, ${input.problemTopic})

Description:
${input.problemDescription}

Submitted code:
\`\`\`python
${input.code}
\`\`\`

Provide the analysis described in your system prompt.`;

  try {
    let buffer = "";
    for await (const m of query({
      prompt: userPrompt,
      options: {
        systemPrompt: analysisPrompt(input.kind),
        maxTurns: 1,
      },
    })) {
      if (m.type === "assistant") {
        for (const block of m.message.content) {
          if (block.type === "text") buffer += block.text;
        }
      }
    }
    if (looksLikeFullSolution(buffer)) {
      return { kind: input.kind, content_md: "[blocked: full-solution leak]", status: "error" };
    }
    return { kind: input.kind, content_md: buffer.trim(), status: "done" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return { kind: input.kind, content_md: `[error: ${msg}]`, status: "error" };
  }
}
```

**Step 4:** Tests green.

**Step 5:** Commit:
```bash
git add lib/analysis/run-one.ts lib/analysis/run-one.test.ts
git commit -m "feat: single-kind analysis runner with safety + error handling"
```

---

### Task 4: Pipeline orchestrator (TDD)

**Files:**
- Create: `lib/analysis/pipeline.ts`, `lib/analysis/pipeline.test.ts`

**Step 1:** Test cases (mock `runOne` so this is fully deterministic):
- First call: inserts 5 `pending` rows immediately, then updates them as `runOne` resolves
- Second call (same attemptId, all rows already `done`): short-circuits and returns existing rows without calling `runOne`
- One kind throws inside `runOne`: row marked `error`, others succeed
- Pattern result `Pattern: sliding window` → calls `bumpPattern(userId, 'sliding window')`
- Mistake result `Category: off-by-one\nForgot to handle empty input` → calls `recordMistake` with category `off-by-one`

**Step 2:** Test fails (module missing).

**Step 3:** Implement:

```ts
import type Database from "better-sqlite3";
import { runOne } from "./run-one";
import {
  upsertAnalysis, getByAttempt, bumpPattern, recordMistake,
  type AnalysisKind,
} from "./repo";

const KINDS: AnalysisKind[] = [
  "quality", "complexity", "comparison", "pattern", "mistake",
];

export type PipelineContext = {
  attemptId: number;
  userId: number;
  problemId: number;
  code: string;
  problemTitle: string;
  problemTopic: string;
  problemDifficulty: string;
  problemDescription: string;
};

export async function runPipeline(
  db: Database.Database,
  ctx: PipelineContext,
): Promise<void> {
  const existing = getByAttempt(db, ctx.attemptId);
  if (existing.length === KINDS.length && existing.every((r) => r.status !== "pending")) {
    return; // idempotent short-circuit
  }
  for (const kind of KINDS) {
    upsertAnalysis(db, {
      attempt_id: ctx.attemptId, kind, content_md: "", status: "pending",
    });
  }
  await Promise.allSettled(
    KINDS.map(async (kind) => {
      const result = await runOne({
        kind,
        code: ctx.code,
        problemTitle: ctx.problemTitle,
        problemTopic: ctx.problemTopic,
        problemDifficulty: ctx.problemDifficulty,
        problemDescription: ctx.problemDescription,
      });
      upsertAnalysis(db, {
        attempt_id: ctx.attemptId,
        kind: result.kind,
        content_md: result.content_md,
        status: result.status,
      });
      if (kind === "pattern" && result.status === "done") {
        const m = result.content_md.match(/^Pattern:\s*([^\n]+)/);
        if (m) bumpPattern(db, ctx.userId, m[1].trim());
      }
      if (kind === "mistake" && result.status === "done") {
        const m = result.content_md.match(/^Category:\s*([^\n]+)\n([\s\S]+)/);
        if (m) {
          recordMistake(db, {
            user_id: ctx.userId,
            problem_id: ctx.problemId,
            attempt_id: ctx.attemptId,
            category: m[1].trim(),
            note: m[2].trim(),
          });
        }
      }
    }),
  );
}
```

**Step 4:** Tests green: `npx vitest run lib/analysis/pipeline.test.ts`.

**Step 5:** Commit:
```bash
git add lib/analysis/pipeline.ts lib/analysis/pipeline.test.ts
git commit -m "feat: analysis pipeline with idempotency + side effects"
```

---

### Task 5: API routes

**Files:**
- Create: `app/api/analysis/[attemptId]/route.ts`
- Create: `app/api/analysis/[attemptId]/route.test.ts` (vitest, mock `runPipeline`)

**Step 1:** Write tests:
- `GET` with no rows yet returns `{rows: []}`
- `POST` triggers `runPipeline` (mocked), returns current rows immediately. Verify it does NOT await pipeline before responding.
- `POST` with a different user's attempt ID returns 404 (verify ownership)

**Step 2:** Tests fail.

**Step 3:** Implement `app/api/analysis/[attemptId]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth/current-user";
import { getByAttempt } from "@/lib/analysis/repo";
import { runPipeline } from "@/lib/analysis/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadCtx(db: ReturnType<typeof getDb>, attemptId: number, userId: number) {
  const row = db.prepare(
    `SELECT a.id, a.user_id, a.problem_id, a.code,
            p.title, p.topic, p.difficulty, p.description_md
     FROM attempts a JOIN problems p ON p.id = a.problem_id
     WHERE a.id = ? AND a.user_id = ?`,
  ).get(attemptId, userId) as
    | { id: number; user_id: number; problem_id: number; code: string;
        title: string; topic: string; difficulty: string; description_md: string }
    | undefined;
  return row;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const userId = await requireUserId();
  const { attemptId } = await params;
  const id = Number(attemptId);
  if (!Number.isFinite(id)) return new Response("bad attemptId", { status: 400 });
  const db = getDb();
  const ctx = await loadCtx(db, id, userId);
  if (!ctx) return new Response("not found", { status: 404 });
  return Response.json({ rows: getByAttempt(db, id) });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const userId = await requireUserId();
  const { attemptId } = await params;
  const id = Number(attemptId);
  if (!Number.isFinite(id)) return new Response("bad attemptId", { status: 400 });
  const db = getDb();
  const ctx = await loadCtx(db, id, userId);
  if (!ctx) return new Response("not found", { status: 404 });

  // Fire-and-forget: kick off the pipeline but respond immediately.
  void runPipeline(db, {
    attemptId: id,
    userId,
    problemId: ctx.problem_id,
    code: ctx.code,
    problemTitle: ctx.title,
    problemTopic: ctx.topic,
    problemDifficulty: ctx.difficulty,
    problemDescription: ctx.description_md,
  });

  return Response.json({ rows: getByAttempt(db, id) });
}
```

**Step 4:** Tests green.

**Step 5:** Commit:
```bash
git add app/api/analysis lib/analysis
git commit -m "feat: GET/POST /api/analysis/[attemptId] with idempotent fire-and-forget"
```

---

### Task 6: `/analysis/[attemptId]` page

**Files:**
- Create: `app/analysis/[attemptId]/page.tsx`
- Create: `app/analysis/[attemptId]/analysis-view.tsx` (client island, polling)
- Modify (only if needed): install `react-markdown`. Run `npm ls react-markdown`; if absent, `npm install react-markdown`.

**Step 1:** Server component (`page.tsx`):

```tsx
import { requireUserId } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { getByAttempt } from "@/lib/analysis/repo";
import { notFound } from "next/navigation";
import { AnalysisView } from "./analysis-view";

export default async function AnalysisPage({
  params,
}: { params: Promise<{ attemptId: string }> }) {
  const userId = await requireUserId();
  const { attemptId } = await params;
  const id = Number(attemptId);
  const db = getDb();
  const owner = db.prepare(
    `SELECT id FROM attempts WHERE id = ? AND user_id = ?`,
  ).get(id, userId);
  if (!owner) notFound();
  const initial = getByAttempt(db, id);
  return <AnalysisView attemptId={id} initial={initial} />;
}
```

**Step 2:** Client island `analysis-view.tsx`:
- Take `initial: Analysis[]`, render five `<section>`s in `KIND_ORDER`
- If any row missing or status `pending`: every 2s, fetch `GET /api/analysis/${id}`, replace state
- Stop polling when all rows are non-`pending`
- Render `content_md` with `react-markdown`
- Show a small status pill per section: pending (animated) / done / error

**Step 3:** Manual smoke: `npm run dev`, hit `/analysis/<some-id>` after creating an attempt, confirm sections render. (No automated test for this page yet — covered by Playwright in Task 8.)

**Step 4:** Commit:
```bash
git add app/analysis package.json package-lock.json
git commit -m "feat: analysis page with polling client island"
```

---

### Task 7: Auto-trigger pipeline on accepted submission

**Files:**
- Modify: `app/problem/[slug]/actions.ts` — return the new attempt ID (already returns `lastInsertRowid` via `recordAttempt`; verify)
- Modify: `app/problem/[slug]/problem-workspace.tsx`

**Step 1:** In `problem-workspace.tsx`, after `submitAttempt(...)` completes when `allPassed` is true:
```ts
const attemptId = await submitAttempt({ ... });
if (allPassed) {
  fetch(`/api/analysis/${attemptId}`, { method: "POST" }).catch(() => {});
  setAnalysisHint(attemptId);
}
```
Add a small banner above the results panel: `Analysis ready → /analysis/{id}` link, dismissible, auto-clear when user runs again.

**Step 2:** Manual smoke in dev: solve a problem, click the link, verify the page renders and polls. Capture a console screenshot if anything looks off.

**Step 3:** Commit:
```bash
git add app/problem
git commit -m "feat: auto-trigger analysis on accepted submission"
```

---

### Task 8: E2E (gated)

**Files:**
- Create: `tests/e2e/analysis.spec.ts`

Mirror the gating pattern from `tests/e2e/coach.spec.ts` (skip if `RUN_ANALYSIS_E2E !== "1"`). Steps:
1. Sign in (existing helper)
2. Open a problem with a known-correct fixture solution (use `lib/agent/test-fixtures` if present; otherwise paste a tiny valid solution for problem id 1 / two-sum)
3. Click "Run tests"; assert all pass
4. Wait for the "View analysis" link; click it
5. Assert page shows all 5 section headers (Quality, Complexity, Comparison, Pattern, Mistake)
6. Wait until no section shows "pending" (timeout 60s)

Commit:
```bash
git add tests/e2e/analysis.spec.ts
git commit -m "test: e2e analysis pipeline (gated)"
```

---

### Task 9: Style mode in CoachPanel

**Files:**
- Modify: `lib/chat/repo.ts` (extend `ChatMode`), `lib/db.ts` (relax `chat_messages.mode` CHECK), `lib/agent/prompts.ts` (add STYLE prompt), `app/api/coach/route.ts` (extend `VALID_MODES`), `components/coach-panel.tsx` (add option), and any tests asserting valid modes

**Step 1:** Update `ChatMode` type:
```ts
export type ChatMode = "socratic" | "hints" | "style";
```

**Step 2:** SQLite CHECK constraint change requires care. Easiest approach: in `getDb()`, after the `db.exec(SCHEMA)` call, run a one-shot migration:
```ts
const chatModeCheck = db.prepare(
  `SELECT sql FROM sqlite_master WHERE type='table' AND name='chat_messages'`,
).get() as { sql: string } | undefined;
if (chatModeCheck && !chatModeCheck.sql.includes("'style'")) {
  db.exec(`
    BEGIN;
    ALTER TABLE chat_messages RENAME TO chat_messages_old;
    CREATE TABLE chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      problem_id INTEGER NOT NULL REFERENCES problems(id),
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('socratic','hints','style')),
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    INSERT INTO chat_messages SELECT * FROM chat_messages_old;
    DROP TABLE chat_messages_old;
    CREATE INDEX IF NOT EXISTS chat_user_problem ON chat_messages(user_id, problem_id, created_at);
    COMMIT;
  `);
}
```
Also update the inline CHECK in the `SCHEMA` constant to `'socratic','hints','style'` so fresh DBs are correct.

**Step 3:** Add `STYLE` system prompt in `lib/agent/prompts.ts`:
```ts
const STYLE = `
You are a Python style reviewer. Critique the user's submitted code for PEP 8
compliance, naming, idiomatic patterns (comprehensions, f-strings, early
returns), and structural clarity. Cite specific lines. Be concise.
${NO_SOLUTION_RULE}
`.trim();

export function systemPrompt(mode: ChatMode): string {
  if (mode === "socratic") return SOCRATIC;
  if (mode === "hints") return HINTS;
  return STYLE;
}
```

**Step 4:** Extend `VALID_MODES` in `app/api/coach/route.ts`:
```ts
const VALID_MODES: ChatMode[] = ["socratic", "hints", "style"];
```

**Step 5:** In `components/coach-panel.tsx`, change `Mode` type and add option:
```tsx
type Mode = "socratic" | "hints" | "style";
// ...
<option value="hints">Hints</option>
<option value="socratic">Socratic</option>
<option value="style">Style</option>
```

**Step 6:** Update / add tests:
- Add a unit test that `systemPrompt('style')` mentions "PEP 8"
- Update any existing test that asserts the mode CHECK constraint set

**Step 7:** Manual smoke: open coach, switch to Style, ask "review my code", confirm streaming response.

**Step 8:** Commit:
```bash
git add lib components app
git commit -m "feat: style mode in coach panel"
```

---

### Task 10: Final verification

**Step 1:** Run full test suite:
```bash
npx vitest run
npx tsc --noEmit
npx eslint .
```
All must pass.

**Step 2:** Manual smoke checklist:
- Solve a problem → analysis page renders all five sections
- Switch coach to Style mode → response streams
- Coach Hints/Socratic still work

**Step 3:** No commit if no changes; otherwise fix-up commit.
