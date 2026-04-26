# Step 7–8: Engagement (SR + Daily + Streak + Stats) + Mock Interview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add `/stats` page, spaced-repetition queue (SM-2 lite), daily problem, dashboard widgets, and a lightweight timed interview mode (`/interview`) on top of stages 1–6.

**Architecture:** Two new tables (`review_queue`, `daily`) plus a `mode` column already on `attempts`. Pure SM-2 module in `lib/sr/sm2.ts`. Daily picker is deterministic from `(userId, date)` seed. Stats page is server-rendered. Interview mode is just a query-string switch on the existing `/problem/[slug]` page that flips the workspace into a timer + hidden-results view and locks the coach to a new `interview` mode.

**Tech Stack:** Next.js 15 App Router, better-sqlite3, Vitest, Playwright, `@anthropic-ai/claude-agent-sdk`.

**Depends on:** Step 5–6 plan must be merged first (uses `runPipeline` + `analyses` table for the interview debrief).

**Commit policy:** Real-time `git commit` after each task.

---

### Task 1: Schema additions + repos (TDD)

**Files:**
- Modify: `lib/db.ts`
- Create: `lib/sr/repo.ts`, `lib/sr/repo.test.ts`
- Create: `lib/daily/repo.ts`, `lib/daily/repo.test.ts`

**Step 1:** Append to `SCHEMA` in `lib/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  due_at INTEGER NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, problem_id)
);
CREATE INDEX IF NOT EXISTS review_due ON review_queue(user_id, due_at);
CREATE TABLE IF NOT EXISTS daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  completed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);
```

Also update the `attempts` table CHECK to require `mode IN ('practice','interview','run')` if/when the column gets a CHECK — currently the column is unconstrained and tests use `'run'`. Decision: keep `mode` unconstrained to avoid breaking existing rows; just document allowed values.

**Step 2:** `lib/sr/repo.test.ts`:
- `upsertReview` inserts new row, second call updates due/ease/interval
- `dueReviews(userId, now)` returns rows with `due_at <= now`, ordered by `due_at`
- `getReviewState(userId, problemId)` returns `null` if absent, else `{ease, interval_days, due_at}`

**Step 3:** Implement `lib/sr/repo.ts`:

```ts
import type Database from "better-sqlite3";

export type ReviewRow = {
  id: number; user_id: number; problem_id: number;
  due_at: number; ease: number; interval_days: number;
};

export function upsertReview(
  db: Database.Database,
  r: { user_id: number; problem_id: number; due_at: number; ease: number; interval_days: number },
): void {
  db.prepare(
    `INSERT INTO review_queue (user_id, problem_id, due_at, ease, interval_days)
     VALUES (@user_id, @problem_id, @due_at, @ease, @interval_days)
     ON CONFLICT(user_id, problem_id) DO UPDATE SET
       due_at = excluded.due_at,
       ease = excluded.ease,
       interval_days = excluded.interval_days`,
  ).run(r);
}

export function dueReviews(db: Database.Database, userId: number, now: number, limit = 20): ReviewRow[] {
  return db.prepare(
    `SELECT id, user_id, problem_id, due_at, ease, interval_days
     FROM review_queue WHERE user_id = ? AND due_at <= ?
     ORDER BY due_at ASC LIMIT ?`,
  ).all(userId, now, limit) as ReviewRow[];
}

export function getReviewState(
  db: Database.Database, userId: number, problemId: number,
): Pick<ReviewRow, "ease" | "interval_days" | "due_at"> | null {
  const r = db.prepare(
    `SELECT ease, interval_days, due_at FROM review_queue
     WHERE user_id = ? AND problem_id = ?`,
  ).get(userId, problemId) as Pick<ReviewRow, "ease" | "interval_days" | "due_at"> | undefined;
  return r ?? null;
}
```

**Step 4:** `lib/daily/repo.test.ts`:
- `getOrCreateDaily(userId, date, pickFn)` calls `pickFn` only on first call
- Second call same day returns existing row without calling `pickFn`
- `markDailyComplete(userId, date)` flips `completed=1`

**Step 5:** Implement `lib/daily/repo.ts`:

```ts
import type Database from "better-sqlite3";

export type DailyRow = {
  id: number; user_id: number; date: string;
  problem_id: number; completed: number;
};

export function getDaily(db: Database.Database, userId: number, date: string): DailyRow | null {
  return (db.prepare(
    `SELECT id, user_id, date, problem_id, completed
     FROM daily WHERE user_id = ? AND date = ?`,
  ).get(userId, date) as DailyRow | undefined) ?? null;
}

export function getOrCreateDaily(
  db: Database.Database,
  userId: number,
  date: string,
  pickFn: () => number,
): DailyRow {
  const existing = getDaily(db, userId, date);
  if (existing) return existing;
  const problemId = pickFn();
  db.prepare(
    `INSERT INTO daily (user_id, date, problem_id) VALUES (?, ?, ?)`,
  ).run(userId, date, problemId);
  return getDaily(db, userId, date)!;
}

export function markDailyComplete(db: Database.Database, userId: number, date: string): void {
  db.prepare(
    `UPDATE daily SET completed = 1 WHERE user_id = ? AND date = ?`,
  ).run(userId, date);
}
```

**Step 6:** Run all new tests: `npx vitest run lib/sr lib/daily`. Green.

**Step 7:** Commit:
```bash
git add lib/db.ts lib/sr lib/daily
git commit -m "feat: review_queue + daily tables and repos"
```

---

### Task 2: SM-2 lite scheduler (TDD)

**Files:**
- Create: `lib/sr/sm2.ts`, `lib/sr/sm2.test.ts`

**Step 1:** Test (table-driven):

```ts
// grade 5: ease unchanged-or-up, interval grows
expect(nextReview({ ease: 2.5, intervalDays: 1, grade: 5, now: 0 }))
  .toMatchObject({ ease: 2.6, intervalDays: 6 });
// grade 4: same
expect(nextReview({ ease: 2.5, intervalDays: 1, grade: 4, now: 0 }))
  .toMatchObject({ ease: 2.5, intervalDays: 6 });
// grade 2 (failed but compiled): reset interval to 1, ease drops
expect(nextReview({ ease: 2.5, intervalDays: 6, grade: 2, now: 0 }))
  .toMatchObject({ ease: 2.18, intervalDays: 1 });
// grade 0 (error): floor ease at 1.3
expect(nextReview({ ease: 1.4, intervalDays: 1, grade: 0, now: 0 }))
  .toMatchObject({ ease: 1.3, intervalDays: 1 });
// dueAt = now + intervalDays * 86_400_000
```

Plus `gradeFromAttempt({status, attemptCount, usedHints})` returning the integer grade per the design doc.

**Step 2:** Implement `lib/sr/sm2.ts`:

```ts
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;
const DAY_MS = 86_400_000;

export function nextReview(opts: {
  ease: number; intervalDays: number; grade: Grade; now: number;
}): { ease: number; intervalDays: number; dueAt: number } {
  const { grade, now } = opts;
  let { ease, intervalDays } = opts;
  if (grade < 3) {
    ease = Math.max(1.3, +(ease - 0.32).toFixed(2));
    intervalDays = 1;
  } else {
    ease = Math.max(1.3, +(ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))).toFixed(2));
    intervalDays = intervalDays === 1 ? 6 : Math.round(intervalDays * ease);
  }
  return { ease, intervalDays, dueAt: now + intervalDays * DAY_MS };
}

export function gradeFromAttempt(a: {
  status: "passed" | "failed" | "error";
  attemptCount: number;
  usedHints: boolean;
}): Grade {
  if (a.status === "error") return 0;
  if (a.status === "failed") return 2;
  if (a.attemptCount === 1 && !a.usedHints) return 5;
  return 4;
}
```

**Step 3:** Tests green: `npx vitest run lib/sr/sm2.test.ts`.

**Step 4:** Commit:
```bash
git add lib/sr/sm2.ts lib/sr/sm2.test.ts
git commit -m "feat: SM-2 lite scheduler"
```

---

### Task 3: Wire SR enqueue on accepted submissions

**Files:**
- Modify: `app/problem/[slug]/actions.ts`
- Create: `app/problem/[slug]/actions.test.ts` if missing — otherwise add to existing test file

**Step 1:** In `submitAttempt`, after `recordAttempt`, if `status === "passed"`:

```ts
import { upsertReview, getReviewState } from "@/lib/sr/repo";
import { nextReview, gradeFromAttempt } from "@/lib/sr/sm2";
import { listAttempts } from "@/lib/attempts/repo";
import { listMessages } from "@/lib/chat/repo";

// inside submitAttempt, after recordAttempt(...):
if (input.status === "passed") {
  const prior = listAttempts(db, userId, input.problemId)
    .filter((a) => a.problem_id === input.problemId).length;
  const usedHints = listMessages(db, userId, input.problemId).length > 0;
  const grade = gradeFromAttempt({
    status: "passed",
    attemptCount: prior, // includes the one we just recorded
    usedHints,
  });
  const prev = getReviewState(db, userId, input.problemId);
  const nr = nextReview({
    ease: prev?.ease ?? 2.5,
    intervalDays: prev?.interval_days ?? 1,
    grade,
    now: Date.now(),
  });
  upsertReview(db, {
    user_id: userId, problem_id: input.problemId,
    due_at: nr.dueAt, ease: nr.ease, interval_days: nr.intervalDays,
  });
}
```

**Step 2:** Add test asserting an accepted submission inserts/updates a `review_queue` row with `due_at > Date.now()`. Use a temp DB.

**Step 3:** Tests green.

**Step 4:** Commit:
```bash
git add app/problem/[slug]/actions.ts app/problem/[slug]/actions.test.ts
git commit -m "feat: enqueue spaced-repetition review on accepted submission"
```

---

### Task 4: Daily picker (TDD)

**Files:**
- Create: `lib/daily/pick.ts`, `lib/daily/pick.test.ts`

**Step 1:** Test:
- Same `(userId, date)` always returns same problemId
- Prefers due-for-review over unsolved-NeetCode-150
- Falls back to unsolved if no due reviews
- Falls back to any random problem if all solved

**Step 2:** Implement:

```ts
import type Database from "better-sqlite3";
import { getSolvedProblemIds } from "@/lib/stats/repo";
import { dueReviews } from "@/lib/sr/repo";

function hashSeed(userId: number, date: string): number {
  let h = 2166136261 ^ userId;
  for (let i = 0; i < date.length; i++) h = Math.imul(h ^ date.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function pickDaily(db: Database.Database, userId: number, dateISO: string, now: number): number {
  const due = dueReviews(db, userId, now, 50);
  const seed = hashSeed(userId, dateISO);
  if (due.length > 0) return due[seed % due.length].problem_id;
  const solved = getSolvedProblemIds(db, userId);
  const all = db.prepare(`SELECT id FROM problems ORDER BY id`).all() as { id: number }[];
  const unsolved = all.filter((r) => !solved.has(r.id));
  const pool = unsolved.length > 0 ? unsolved : all;
  return pool[seed % pool.length].id;
}
```

**Step 3:** Tests green.

**Step 4:** Commit:
```bash
git add lib/daily/pick.ts lib/daily/pick.test.ts
git commit -m "feat: deterministic daily problem picker"
```

---

### Task 5: `/api/daily` route + `markDailyComplete` hook

**Files:**
- Create: `app/api/daily/route.ts`
- Modify: `app/problem/[slug]/actions.ts` (set daily complete on accepted)

**Step 1:** `GET /api/daily` — returns today's daily row, creating it via `pickDaily` if missing. Date = `new Date().toISOString().slice(0,10)` (UTC).

**Step 2:** In `submitAttempt`, after the SR enqueue: if today's daily row's `problem_id === input.problemId` and accepted, call `markDailyComplete`.

**Step 3:** Commit:
```bash
git add app/api/daily app/problem/[slug]/actions.ts
git commit -m "feat: daily problem endpoint + completion hook"
```

---

### Task 6: Dashboard widgets

**Files:**
- Modify: `app/page.tsx` (the dashboard) and any sub-components

**Step 1:** Find existing dashboard render. Add three widgets above existing content:
- **Streak card:** uses `getDayStreak(db, userId)` (already exists in `lib/stats/repo.ts`)
- **Daily problem card:** server-side calls `getOrCreateDaily(db, userId, today, () => pickDaily(...))`. Renders title + difficulty + status (start / continue / completed).
- **Due reviews:** top 3 from `dueReviews(db, userId, Date.now(), 3)`, each linking to the problem.

**Step 2:** Manual smoke. Visit `/` after seeding some attempts.

**Step 3:** Commit:
```bash
git add app/page.tsx
git commit -m "feat: dashboard streak, daily, and due-review widgets"
```

---

### Task 7: `/stats` page

**Files:**
- Create: `app/stats/page.tsx`
- Create: `lib/stats/aggregate.ts`, `lib/stats/aggregate.test.ts`

**Step 1:** `lib/stats/aggregate.ts` exports:
- `solvedByTopic(db, userId): {topic: string; solved: number; total: number}[]`
- `solvedByDifficulty(db, userId): {difficulty: string; solved: number; total: number}[]`
- `recentMistakes(db, userId, limit): MistakeRow[]` (re-export from `lib/analysis/repo`)
- `patternMastery(db, userId): {pattern: string; solved_count: number}[]` (uses `listPatternCounters`)

Test each with a small fixture.

**Step 2:** `app/stats/page.tsx` server component renders four sections (bars built with simple flex divs — no chart lib). Plus a "Due reviews" list.

**Step 3:** Manual smoke.

**Step 4:** Commit:
```bash
git add app/stats lib/stats/aggregate.ts lib/stats/aggregate.test.ts
git commit -m "feat: /stats page with topic, difficulty, mistakes, patterns"
```

---

### Task 8: Interview mode — coach prompt + DB CHECK update

**Files:**
- Modify: `lib/agent/prompts.ts`, `lib/chat/repo.ts`, `lib/db.ts`, `app/api/coach/route.ts`, `components/coach-panel.tsx`

**Step 1:** Add `interview` to `ChatMode`. Re-run the same one-shot CHECK migration trick from step 5–6 plan task 9, this time including `'interview'`. Update the inline `SCHEMA` literal so fresh DBs have the right CHECK from the start.

**Step 2:** Add system prompt `INTERVIEW`:

```ts
const INTERVIEW = `
You are a technical interviewer. The candidate is solving a problem under
time pressure. Ask clarifying questions when appropriate. NEVER give hints,
solutions, pseudocode, or style critique. If the candidate asks for help,
respond like an interviewer would: redirect with a clarifying question or
ask them to explain their current approach.
${NO_SOLUTION_RULE}
`.trim();
```

Wire into `systemPrompt(mode)`.

**Step 3:** Add `'interview'` to `VALID_MODES` in the coach route.

**Step 4:** In `CoachPanel`, accept a new optional prop `lockedMode?: Mode`. When set, hide the `<select>` and force that mode for all sends.

**Step 5:** Test: `systemPrompt('interview')` mentions "interviewer" and "NEVER give hints".

**Step 6:** Commit:
```bash
git add lib components app
git commit -m "feat: interview mode for coach (locked, clarifying-only)"
```

---

### Task 9: `/interview` landing + interview-mode workspace

**Files:**
- Create: `app/interview/page.tsx`, `app/interview/start.ts` (server action)
- Modify: `app/problem/[slug]/page.tsx`, `app/problem/[slug]/problem-workspace.tsx`

**Step 1:** `/interview/page.tsx` — single button "Start 30-min session" → server action picks a random unsolved problem id and `redirect()`s to `/problem/<slug>?mode=interview&duration=30`.

**Step 2:** In the problem page (server component), read `searchParams.mode` and `searchParams.duration`, pass to workspace as props `interviewMode: boolean` and `interviewDurationMin: number`.

**Step 3:** In `problem-workspace.tsx`:
- If `interviewMode`, render a header bar with countdown (use a `useEffect`-driven `setInterval` and `Date.now()`; format `mm:ss`)
- On expiry: auto-call `onRun()` once, then show "Session ended" overlay with a link to `/analysis/<lastAttemptId>` once that's available
- In the results panel, if `interviewMode`, replace the per-case PASS/FAIL list with a single line: "Compiled" or "Runtime error: <message>"
- Pass `lockedMode="interview"` to `CoachPanel` so the user can't switch modes
- Set `mode: "interview"` in the `submitAttempt` payload

**Step 4:** Manual smoke: start session, confirm timer counts down, confirm coach is locked, confirm results are hidden, confirm auto-submit at expiry.

**Step 5:** Commit:
```bash
git add app/interview app/problem
git commit -m "feat: lightweight mock interview mode (timer, hidden results, locked coach)"
```

---

### Task 10: Interview-debrief analysis kind

**Files:**
- Modify: `lib/db.ts` (extend `analyses.kind` CHECK to include `'interview_debrief'`), `lib/analysis/repo.ts` (extend `AnalysisKind`), `lib/analysis/prompts.ts` (add prompt), `lib/analysis/pipeline.ts` (run debrief only when attempt's `mode === 'interview'`)
- Modify: `app/api/analysis/[attemptId]/route.ts` (load attempt mode and pass to pipeline)
- Modify: `app/analysis/[attemptId]/analysis-view.tsx` (render the new section conditionally)

**Step 1:** Same CHECK-migration trick on `analyses` table (rename / recreate / copy / drop).

**Step 2:** Add `INTERVIEW_DEBRIEF` prompt: instruct model to summarize process — time-to-first-test (extracted from attempts timeline if available; otherwise omit), how the candidate handled the problem, communication style as inferred from coach chat history.

**Step 3:** Pipeline change: pipeline accepts a `mode` field; when `'interview'`, also runs a sixth `runOne({kind:'interview_debrief'})` call and upserts. The non-interview path is unchanged.

**Step 4:** Test that pipeline runs 6 kinds for interview attempts and 5 otherwise.

**Step 5:** Commit:
```bash
git add lib app
git commit -m "feat: interview_debrief analysis kind for interview attempts"
```

---

### Task 11: E2E (gated) + final verification

**Files:**
- Create: `tests/e2e/stats.spec.ts` and `tests/e2e/interview.spec.ts` (gate behind `RUN_ENGAGEMENT_E2E === "1"`)

**stats.spec.ts:**
1. Sign in
2. Visit `/stats`, assert "Solved by topic", "Solved by difficulty", "Recent mistakes", "Pattern mastery" headings render

**interview.spec.ts:**
1. Sign in
2. Visit `/interview`, click "Start 30-min session"
3. Assert URL includes `mode=interview&duration=30`
4. Assert timer renders (`mm:ss` regex)
5. Open coach panel, confirm mode selector is hidden
6. Click "Run tests" (with starter code), confirm results show "Compiled" or "Runtime error" — not per-case PASS/FAIL

**Final verification:**
```bash
npx vitest run
npx tsc --noEmit
npx eslint .
```

Commit any fix-ups.
