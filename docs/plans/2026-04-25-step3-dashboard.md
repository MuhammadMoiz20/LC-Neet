# Step 3: Dashboard + Per-Problem Status Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the placeholder home page with a real dashboard (solved count, streak, recent attempts) and surface per-problem solved/attempted status on the problems list.

**Architecture:** Attempts are already persisted (Step 2). This step is read-side only: a `lib/stats/repo.ts` module computes user-scoped aggregates (solved set, recent attempts, day streak) from the existing `attempts` table, and two server components (`/`, `/problems`) consume it. Both pages get `export const dynamic = "force-dynamic"` so they reflect live state per request.

**Tech Stack:** Existing — Next.js Server Components, SQLite, Vitest, Playwright.

**Commit policy:** Real-time `git commit`.

---

### Task 1: Stats repo (TDD)

**Files:**
- Create: `lib/stats/repo.ts`, `lib/stats/repo.test.ts`

**Step 1: Write `lib/stats/repo.test.ts`:**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import { recordAttempt } from "../attempts/repo";
import {
  getSolvedProblemIds,
  getRecentAttempts,
  getDayStreak,
} from "./repo";

const TEST_DB = "data/stats-test.db";

async function setup() {
  __resetDbCache();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const db = getDb(TEST_DB);
  seedProblems(db);
  const user = await createUser(db, "u@example.com", "pw");
  return { db, userId: user.id };
}

describe("stats/repo", () => {
  it("getSolvedProblemIds returns distinct problem ids with at least one passed attempt", async () => {
    const { db, userId } = await setup();
    recordAttempt(db, { user_id: userId, problem_id: 1, code: "x", status: "failed", runtime_ms: 1, mode: "run" });
    recordAttempt(db, { user_id: userId, problem_id: 1, code: "x", status: "passed", runtime_ms: 1, mode: "run" });
    recordAttempt(db, { user_id: userId, problem_id: 2, code: "x", status: "passed", runtime_ms: 1, mode: "run" });
    recordAttempt(db, { user_id: userId, problem_id: 3, code: "x", status: "failed", runtime_ms: 1, mode: "run" });
    const solved = getSolvedProblemIds(db, userId);
    expect([...solved].sort()).toEqual([1, 2]);
  });

  it("getRecentAttempts returns latest N joined with problem title", async () => {
    const { db, userId } = await setup();
    recordAttempt(db, { user_id: userId, problem_id: 1, code: "a", status: "failed", runtime_ms: 1, mode: "run" });
    recordAttempt(db, { user_id: userId, problem_id: 2, code: "b", status: "passed", runtime_ms: 1, mode: "run" });
    const recent = getRecentAttempts(db, userId, 5);
    expect(recent.length).toBe(2);
    expect(recent[0].problem_title).toBe("Valid Anagram");
    expect(recent[0].status).toBe("passed");
  });

  it("getDayStreak counts consecutive days ending today with at least one attempt", async () => {
    const { db, userId } = await setup();
    const today = Math.floor(Date.now() / 1000);
    const day = 24 * 60 * 60;
    db.prepare(
      "INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode, created_at) VALUES (?, 1, 'x', 'passed', 1, 'run', ?)",
    ).run(userId, today);
    db.prepare(
      "INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode, created_at) VALUES (?, 1, 'x', 'passed', 1, 'run', ?)",
    ).run(userId, today - day);
    db.prepare(
      "INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode, created_at) VALUES (?, 1, 'x', 'passed', 1, 'run', ?)",
    ).run(userId, today - 3 * day);
    expect(getDayStreak(db, userId)).toBe(2);
  });

  it("getDayStreak returns 0 when no attempts today or yesterday", async () => {
    const { db, userId } = await setup();
    const old = Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60;
    db.prepare(
      "INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode, created_at) VALUES (?, 1, 'x', 'passed', 1, 'run', ?)",
    ).run(userId, old);
    expect(getDayStreak(db, userId)).toBe(0);
  });
});
```

**Step 2: Run, see RED.**
```bash
npx vitest run lib/stats/repo.test.ts
```

**Step 3: Implement `lib/stats/repo.ts`:**

```ts
import type Database from "better-sqlite3";

export type RecentAttempt = {
  id: number;
  problem_id: number;
  problem_slug: string;
  problem_title: string;
  status: string;
  runtime_ms: number | null;
  created_at: number;
};

export function getSolvedProblemIds(
  db: Database.Database,
  userId: number,
): Set<number> {
  const rows = db
    .prepare(
      `SELECT DISTINCT problem_id FROM attempts
       WHERE user_id = ? AND status = 'passed'`,
    )
    .all(userId) as { problem_id: number }[];
  return new Set(rows.map((r) => r.problem_id));
}

export function getRecentAttempts(
  db: Database.Database,
  userId: number,
  limit: number,
): RecentAttempt[] {
  return db
    .prepare(
      `SELECT a.id, a.problem_id, p.slug AS problem_slug, p.title AS problem_title,
              a.status, a.runtime_ms, a.created_at
       FROM attempts a
       JOIN problems p ON p.id = a.problem_id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC
       LIMIT ?`,
    )
    .all(userId, limit) as RecentAttempt[];
}

/**
 * Day streak = number of consecutive calendar days (in local time, ending today)
 * on which the user made at least one attempt. Today with zero attempts → 0.
 * Today with attempts but yesterday empty → 1.
 */
export function getDayStreak(db: Database.Database, userId: number): number {
  const rows = db
    .prepare(
      `SELECT DISTINCT date(created_at, 'unixepoch', 'localtime') AS d
       FROM attempts
       WHERE user_id = ?
       ORDER BY d DESC`,
    )
    .all(userId) as { d: string }[];
  if (rows.length === 0) return 0;
  const days = rows.map((r) => r.d);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (days[0] !== todayStr) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + "T00:00:00");
    const cur = new Date(days[i] + "T00:00:00");
    const diff = Math.round((prev.getTime() - cur.getTime()) / 86_400_000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}
```

**Step 4: Run, see GREEN.**

**Step 5: Full suite.**
```bash
npm test
```

**Step 6: Commit.**
```bash
git add lib/stats/
git commit -m "feat: stats repo (solved set, recent, streak)"
```

---

### Task 2: Auth helper for server components

**Files:**
- Create: `lib/auth/current-user.ts`

**Why:** Both `/` and `/problems` need the signed-in user id. Centralize so we don't repeat `auth()` + null-check + Number() three times.

**Step 1: Create `lib/auth/current-user.ts`:**

```ts
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUserId(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return Number(session.user.id);
}
```

**Step 2: Verify it type-checks.**
```bash
npx tsc --noEmit
```

**Step 3: Commit.**
```bash
git add lib/auth/current-user.ts
git commit -m "feat: requireUserId helper for server components"
```

---

### Task 3: Augment problems list with status badges

**Files:**
- Modify: `app/problems/page.tsx`

**Step 1: Read current `app/problems/page.tsx`. Replace its contents with:**

```tsx
import Link from "next/link";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import { getSolvedProblemIds } from "@/lib/stats/repo";
import { requireUserId } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function ProblemsPage() {
  const userId = await requireUserId();
  const db = getDb();
  const problems = listProblems(db);
  const solved = getSolvedProblemIds(db, userId);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Problems</h1>
        <p className="text-sm text-zinc-400">
          {solved.size} / {problems.length} solved
        </p>
      </div>
      <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded">
        {problems.map((p) => (
          <li key={p.id}>
            <Link
              href={`/problem/${p.slug}`}
              className="flex items-center justify-between p-3 hover:bg-zinc-900"
            >
              <span className="flex items-center gap-3">
                <StatusDot solved={solved.has(p.id)} />
                <span>
                  <span className="text-zinc-500 mr-2">{p.id}.</span>
                  {p.title}
                </span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800">
                {p.difficulty}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function StatusDot({ solved }: { solved: boolean }) {
  return (
    <span
      aria-label={solved ? "Solved" : "Unsolved"}
      className={`inline-block h-2 w-2 rounded-full ${
        solved ? "bg-emerald-500" : "bg-zinc-700"
      }`}
    />
  );
}
```

**Step 2: Verify build.**
```bash
npm run build 2>&1 | tail -15
```
Expect `/problems` shown as `ƒ` (dynamic) now.

**Step 3: Commit.**
```bash
git add app/problems/page.tsx
git commit -m "feat: per-problem solved badges + counter"
```

---

### Task 4: Dashboard at `/`

**Files:**
- Modify: `app/page.tsx`
- Create: `components/sign-out-button.tsx`

**Step 1: Create `components/sign-out-button.tsx`:**

```tsx
"use client";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-zinc-400 hover:text-zinc-100"
    >
      Sign out
    </button>
  );
}
```

**Step 2: Read current `app/page.tsx`. Replace its contents with:**

```tsx
import Link from "next/link";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import {
  getSolvedProblemIds,
  getRecentAttempts,
  getDayStreak,
} from "@/lib/stats/repo";
import { requireUserId } from "@/lib/auth/current-user";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await requireUserId();
  const db = getDb();
  const problems = listProblems(db);
  const solved = getSolvedProblemIds(db, userId);
  const recent = getRecentAttempts(db, userId, 10);
  const streak = getDayStreak(db, userId);

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <SignOutButton />
      </header>

      <section className="grid grid-cols-3 gap-4 mb-8">
        <Stat label="Solved" value={`${solved.size} / ${problems.length}`} />
        <Stat label="Day streak" value={streak.toString()} />
        <Stat label="Total attempts" value={recent.length === 10 ? "10+" : recent.length.toString()} />
      </section>

      <section className="mb-8">
        <Link
          href="/problems"
          className="inline-block px-4 py-2 rounded bg-white text-black font-medium"
        >
          Browse Problems →
        </Link>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent attempts</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No attempts yet. Pick a problem and run some code.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/problem/${a.problem_slug}`}
                  className="flex items-center justify-between p-3 hover:bg-zinc-900 text-sm"
                >
                  <span>{a.problem_title}</span>
                  <span className="flex items-center gap-3">
                    <StatusBadge status={a.status} />
                    <time className="text-zinc-500" dateTime={new Date(a.created_at * 1000).toISOString()}>
                      {timeAgo(a.created_at)}
                    </time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 rounded p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "passed"
      ? "bg-emerald-950 text-emerald-300 border-emerald-900"
      : status === "failed"
        ? "bg-amber-950 text-amber-300 border-amber-900"
        : "bg-red-950 text-red-300 border-red-900";
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>
      {status}
    </span>
  );
}

function timeAgo(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
```

**Step 3: Verify build + lint.**
```bash
npm run build 2>&1 | tail -15
npm run lint 2>&1 | tail -10
```

**Step 4: Commit.**
```bash
git add app/page.tsx components/sign-out-button.tsx
git commit -m "feat: dashboard with stats + recent attempts + sign out"
```

---

### Task 5: E2E — dashboard reflects a solved problem

**Files:**
- Create: `tests/e2e/dashboard.spec.ts`

**Step 1: Create `tests/e2e/dashboard.spec.ts`:**

```ts
import { test, expect } from "@playwright/test";

test("dashboard shows recent attempt after solving two-sum", async ({ page }) => {
  // Solve Two Sum
  await page.goto("/problem/two-sum");
  const runBtn = page.getByRole("button", { name: /Run tests/ });
  await expect(runBtn).toBeEnabled({ timeout: 60_000 });

  // Replace starter code with a working solution
  // Monaco's textarea is hidden; click into the editor area then select-all + paste.
  await page.locator(".monaco-editor textarea").first().click();
  await page.keyboard.press("Meta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(
    `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
`,
    { delay: 0 },
  );

  await runBtn.click();
  await expect(page.getByText(/Case 1: PASS/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Case 2: PASS/)).toBeVisible();

  // Dashboard should now show the attempt + bumped solved counter
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Recent attempts")).toBeVisible();
  await expect(page.getByRole("link", { name: /Two Sum/ })).toBeVisible();
  // At least 1 solved
  await expect(page.getByText(/[1-9]\d* \/ 3/)).toBeVisible();
});
```

**Step 2: Run E2E.**
```bash
npx playwright test 2>&1 | tail -30
```

Expect 3 passing (auth redirect + problem-run + dashboard).

If Monaco's keyboard interaction is flaky on some platforms, the fallback is `page.evaluate` to set the editor's value via the `monaco` global. But try the simple path first.

Make sure no orphan port-3000 listener after.

**Step 3: Commit.**
```bash
git add tests/e2e/dashboard.spec.ts
git commit -m "test: e2e dashboard reflects solved problem"
```

---

### Task 6: Final verify + push

**Step 1: All green.**
```bash
npm test && npx playwright test && npx tsc --noEmit && npm run lint
```

**Step 2: Push.**
```bash
git push origin main
```

**Step 3: Manual smoke (you, in a browser):** sign in → land on dashboard with 0 solved → solve Two Sum → return to `/` → see solved count = 1, streak = 1, recent attempt visible. Visit `/problems` → green dot next to Two Sum.

---

## Done Criteria

- `/` shows: solved count / total, day streak, recent attempts list, sign-out button
- `/problems` shows green dot next to solved problems and an "X / 3 solved" header
- Both pages render dynamically (re-fetch on each request)
- All vitest + Playwright tests green; tsc + lint clean
- Pushed to `origin/main`

## Out of scope (deferred)

- Difficulty breakdowns / per-topic stats (Step 7)
- Spaced repetition queue (Step 7)
- Daily problem (Step 7)
- AI coach panel (Step 4)
