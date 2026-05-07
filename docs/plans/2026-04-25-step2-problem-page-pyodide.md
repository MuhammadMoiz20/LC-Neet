# Step 2: Problem Page + Monaco + Pyodide + Test Harness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up the core "do a problem" experience — list page, problem detail page with Monaco editor, Pyodide-powered in-browser Python execution, custom + default test runner, and persisted submission attempts.

**Architecture:** Pyodide loads in a Web Worker on `/problem/[slug]` mount; the worker exposes `runTests(code, testCases, methodName)` and returns per-case pass/fail with stdout/exception details. The React page is a server component that fetches problem data via direct DB query and renders a client component containing Monaco + the runner. Submission writes to the `attempts` table via a server action.

**Tech Stack:** Pyodide v0.27 (CDN), `@monaco-editor/react`, Next.js Server Components + Server Actions, the existing SQLite + Vitest + Playwright setup.

**Commit policy:** Real-time `git commit` (no `bcommit`). Step 1's backdating was specifically for the 4-month contribution-graph backfill; ongoing work commits at present date.

---

### Task 1: Schema migration — add `method_name` to problems

**Files:**
- Modify: `lib/db.ts` (add column + migration)
- Modify: `lib/problems/types.ts` (add `method_name: string`)
- Modify: `lib/problems/neetcode150.json` (add `method_name` to all 3 entries)
- Modify: `lib/seed.ts` (include `method_name` in upsert)
- Test: `lib/db.test.ts` (assert column exists), `lib/seed.test.ts` (assert method_name persists)

**Why:** The test harness needs to know which method on `Solution` to call. Storing it explicitly is cleaner than parsing user code at runtime.

**Step 1: Update test `lib/db.test.ts`** — add to the "creates schema" test:
```ts
const cols = db.prepare("PRAGMA table_info(problems)").all().map((r: { name: string }) => r.name);
expect(cols).toContain("method_name");
```

**Step 2: Run, see it fail.**

```bash
npx vitest run lib/db.test.ts
```

**Step 3: Update `lib/db.ts`** — add `method_name TEXT NOT NULL DEFAULT ''` to the `problems` schema, then add a one-time migration after `db.exec(SCHEMA)`:

```ts
const cols = db.prepare("PRAGMA table_info(problems)").all() as { name: string }[];
if (!cols.some((c) => c.name === "method_name")) {
  db.exec("ALTER TABLE problems ADD COLUMN method_name TEXT NOT NULL DEFAULT ''");
}
```

**Step 4:** Re-run db test → green.

**Step 5: Update `lib/problems/types.ts`** — add `method_name: z.string()` to the `Problem` schema.

**Step 6: Update `lib/problems/neetcode150.json`** — add to each problem:
- Two Sum → `"method_name": "twoSum"`
- Valid Anagram → `"method_name": "isAnagram"`
- Contains Duplicate → `"method_name": "containsDuplicate"`

**Step 7: Update `lib/seed.ts`** — include `method_name` in the INSERT column list, the VALUES, the ON CONFLICT update list, and the explicit param object.

**Step 8: Update `lib/seed.test.ts`** — add an assertion after the insert test:
```ts
const row = db.prepare("SELECT method_name FROM problems WHERE slug = ?").get("two-sum") as { method_name: string };
expect(row.method_name).toBe("twoSum");
```

**Step 9:** Run full suite → all green.

```bash
npm test
```

**Step 10: Re-seed real DB.**

```bash
rm -f data/app.db && npm run seed
```
Expected: `Seeded 3 problems.`

**Step 11: Commit.**

```bash
git add lib/db.ts lib/db.test.ts lib/problems/ lib/seed.ts lib/seed.test.ts
git commit -m "feat: add method_name column to problems schema"
```

---

### Task 2: Test harness Python module

**Files:**
- Create: `lib/pyodide/harness.py`

**Why:** Single source of truth for "given user code + test cases + method name, run them and return structured results". Both the worker and any future Node-side runner can load the same Python.

**Step 1: Create `lib/pyodide/harness.py`:**

```python
"""Test harness executed inside Pyodide.

Loads the user's solution module, instantiates `Solution`, calls
`<method_name>(**case["input"])`, compares to `case["expected"]`,
captures stdout and exceptions per case.
"""

import io
import json
import sys
import time
import traceback
import types


def _run_one(solution, method_name, case):
    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    start = time.perf_counter()
    try:
        method = getattr(solution, method_name)
        actual = method(**case["input"])
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        passed = actual == case["expected"]
        return {
            "passed": passed,
            "actual": actual,
            "expected": case["expected"],
            "stdout": buf.getvalue(),
            "elapsed_ms": elapsed_ms,
            "error": None,
        }
    except Exception:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        return {
            "passed": False,
            "actual": None,
            "expected": case["expected"],
            "stdout": buf.getvalue(),
            "elapsed_ms": elapsed_ms,
            "error": traceback.format_exc(),
        }
    finally:
        sys.stdout = real_stdout


def run_tests(user_code: str, test_cases_json: str, method_name: str) -> str:
    """Entry point called from JS. Returns JSON string."""
    cases = json.loads(test_cases_json)
    mod = types.ModuleType("user_solution")
    try:
        exec(user_code, mod.__dict__)
    except Exception:
        return json.dumps({
            "compile_error": traceback.format_exc(),
            "results": [],
        })
    if "Solution" not in mod.__dict__:
        return json.dumps({
            "compile_error": "Your code must define a `Solution` class.",
            "results": [],
        })
    solution = mod.Solution()
    results = [_run_one(solution, method_name, c) for c in cases]
    return json.dumps({"compile_error": None, "results": results})
```

**Step 2:** No test in this task — exercised in Task 3 via the worker. Just verify the file parses:

```bash
python3 -c "import ast; ast.parse(open('lib/pyodide/harness.py').read()); print('ok')"
```
Expected: `ok`.

**Step 3: Commit.**

```bash
git add lib/pyodide/harness.py
git commit -m "feat: python test harness for pyodide"
```

---

### Task 3: Pyodide Web Worker

**Files:**
- Create: `lib/pyodide/worker.ts`, `lib/pyodide/worker-protocol.ts`

**Why:** Pyodide must run off the main thread or it freezes the UI during the ~2s Python boot.

**Step 1: Create `lib/pyodide/worker-protocol.ts`** (shared types so the page and worker stay in sync):

```ts
export type WorkerRequest =
  | { id: string; type: "init" }
  | {
      id: string;
      type: "run";
      code: string;
      testCasesJson: string;
      methodName: string;
    };

export type TestResult = {
  passed: boolean;
  actual: unknown;
  expected: unknown;
  stdout: string;
  elapsed_ms: number;
  error: string | null;
};

export type RunResult = {
  compile_error: string | null;
  results: TestResult[];
};

export type WorkerResponse =
  | { id: string; type: "ready" }
  | { id: string; type: "result"; result: RunResult }
  | { id: string; type: "error"; error: string };
```

**Step 2: Create `lib/pyodide/worker.ts`:**

```ts
/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

const PYODIDE_VERSION = "0.27.7";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

declare const self: DedicatedWorkerGlobalScope & {
  loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideAPI>;
  pyodide?: PyodideAPI;
};

type PyodideAPI = {
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { get: (name: string) => unknown };
};

let harnessSource: string | null = null;
let initPromise: Promise<void> | null = null;

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    self.importScripts(`${PYODIDE_CDN}pyodide.js`);
    self.pyodide = await self.loadPyodide!({ indexURL: PYODIDE_CDN });
    if (!harnessSource) {
      const res = await fetch("/api/harness");
      harnessSource = await res.text();
    }
    await self.pyodide.runPythonAsync(harnessSource);
  })();
  return initPromise;
}

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      await init();
      post({ id: msg.id, type: "ready" });
      return;
    }
    if (msg.type === "run") {
      await init();
      const py = self.pyodide!;
      // Bind args into Python globals to avoid string-escape pain
      (py.globals as unknown as { set: (k: string, v: unknown) => void }).set(
        "__user_code",
        msg.code,
      );
      (py.globals as unknown as { set: (k: string, v: unknown) => void }).set(
        "__cases_json",
        msg.testCasesJson,
      );
      (py.globals as unknown as { set: (k: string, v: unknown) => void }).set(
        "__method_name",
        msg.methodName,
      );
      const raw = await py.runPythonAsync(
        "run_tests(__user_code, __cases_json, __method_name)",
      );
      post({
        id: msg.id,
        type: "result",
        result: JSON.parse(String(raw)),
      });
    }
  } catch (err) {
    post({
      id: msg.id,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
```

**Step 3: Create `app/api/harness/route.ts`** — serves `harness.py` to the worker:

```ts
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  const src = fs.readFileSync(
    path.join(process.cwd(), "lib/pyodide/harness.py"),
    "utf8",
  );
  return new NextResponse(src, {
    headers: { "Content-Type": "text/x-python" },
  });
}
```

**Step 4: Allow harness route through middleware** — modify `middleware.ts` to also bypass `/api/harness`:

Find the line that allows `/api/auth` and add `/api/harness` similarly.

**Step 5: Commit.**

```bash
git add lib/pyodide/worker.ts lib/pyodide/worker-protocol.ts app/api/harness/ middleware.ts
git commit -m "feat: pyodide web worker + harness route"
```

---

### Task 4: Pyodide React hook

**Files:**
- Create: `lib/pyodide/use-pyodide-runner.ts`

**Step 1: Create the hook:**

```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RunResult,
  WorkerRequest,
  WorkerResponse,
} from "./worker-protocol";

type Status = "idle" | "loading" | "ready" | "running" | "error";

export function usePyodideRunner() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<
    Map<string, (r: WorkerResponse) => void>
  >(new Map());
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const w = new Worker(
      new URL("./worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const cb = pendingRef.current.get(e.data.id);
      if (cb) {
        cb(e.data);
        pendingRef.current.delete(e.data.id);
      }
    };
    w.onerror = (e) => {
      setStatus("error");
      setErrorMsg(e.message);
    };
    setStatus("loading");
    const id = crypto.randomUUID();
    pendingRef.current.set(id, (resp) => {
      if (resp.type === "ready") setStatus("ready");
      else if (resp.type === "error") {
        setStatus("error");
        setErrorMsg(resp.error);
      }
    });
    w.postMessage({ id, type: "init" } satisfies WorkerRequest);
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const run = useCallback(
    (code: string, testCasesJson: string, methodName: string) =>
      new Promise<RunResult>((resolve, reject) => {
        const w = workerRef.current;
        if (!w) return reject(new Error("Worker not ready"));
        const id = crypto.randomUUID();
        pendingRef.current.set(id, (resp) => {
          if (resp.type === "result") resolve(resp.result);
          else if (resp.type === "error") reject(new Error(resp.error));
        });
        setStatus("running");
        w.postMessage({
          id,
          type: "run",
          code,
          testCasesJson,
          methodName,
        } satisfies WorkerRequest);
      }).finally(() => setStatus("ready")),
    [],
  );

  return { status, errorMsg, run };
}
```

**Step 2: Commit** — no test yet, exercised end-to-end in Task 9.

```bash
git add lib/pyodide/use-pyodide-runner.ts
git commit -m "feat: react hook wrapping pyodide worker"
```

---

### Task 5: Monaco editor component

**Files:**
- Create: `components/code-editor.tsx`
- Modify: `package.json` (add dep)

**Step 1: Install:**

```bash
npm install @monaco-editor/react
```

**Step 2: Create `components/code-editor.tsx`:**

```tsx
"use client";
import dynamic from "next/dynamic";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function CodeEditor({ value, onChange }: Props) {
  return (
    <Monaco
      height="100%"
      defaultLanguage="python"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
      }}
    />
  );
}
```

**Step 3: Commit.**

```bash
git add components/code-editor.tsx package.json package-lock.json
git commit -m "feat: monaco code editor component"
```

---

### Task 6: Problem data accessors (TDD)

**Files:**
- Create: `lib/problems/repo.ts`, `lib/problems/repo.test.ts`

**Step 1: Write `lib/problems/repo.test.ts`:**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { listProblems, getProblemBySlug } from "./repo";

const TEST_DB = "data/repo-test.db";

describe("problems/repo", () => {
  beforeEach(() => {
    __resetDbCache();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const db = getDb(TEST_DB);
    seedProblems(db);
  });

  it("listProblems returns all seeded problems", () => {
    const all = listProblems(getDb(TEST_DB));
    expect(all.length).toBe(3);
    expect(all.map((p) => p.slug).sort()).toEqual([
      "contains-duplicate",
      "two-sum",
      "valid-anagram",
    ]);
  });

  it("getProblemBySlug returns hydrated problem with parsed test_cases", () => {
    const p = getProblemBySlug(getDb(TEST_DB), "two-sum");
    expect(p).not.toBeNull();
    expect(p!.method_name).toBe("twoSum");
    expect(p!.test_cases.length).toBe(2);
  });

  it("getProblemBySlug returns null for unknown slug", () => {
    expect(getProblemBySlug(getDb(TEST_DB), "no-such")).toBeNull();
  });
});
```

**Step 2:** Run, see RED.

**Step 3: Implement `lib/problems/repo.ts`:**

```ts
import type Database from "better-sqlite3";
import type { Problem } from "./types";

type Row = Omit<Problem, "test_cases"> & { test_cases_json: string };

function hydrate(row: Row): Problem {
  const { test_cases_json, ...rest } = row;
  return { ...rest, test_cases: JSON.parse(test_cases_json) };
}

export function listProblems(db: Database.Database): Problem[] {
  const rows = db
    .prepare(
      "SELECT id, slug, title, difficulty, topic, neetcode_video_url, description_md, starter_code, test_cases_json, editorial_md, method_name FROM problems ORDER BY id",
    )
    .all() as Row[];
  return rows.map(hydrate);
}

export function getProblemBySlug(
  db: Database.Database,
  slug: string,
): Problem | null {
  const row = db
    .prepare(
      "SELECT id, slug, title, difficulty, topic, neetcode_video_url, description_md, starter_code, test_cases_json, editorial_md, method_name FROM problems WHERE slug = ?",
    )
    .get(slug) as Row | undefined;
  return row ? hydrate(row) : null;
}
```

**Step 4:** Run, see GREEN.

**Step 5: Commit.**

```bash
git add lib/problems/repo.ts lib/problems/repo.test.ts
git commit -m "feat: problem repo accessors"
```

---

### Task 7: Attempts repo + submit action (TDD)

**Files:**
- Create: `lib/attempts/repo.ts`, `lib/attempts/repo.test.ts`

**Step 1: Write `lib/attempts/repo.test.ts`:**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import { recordAttempt, listAttempts } from "./repo";

const TEST_DB = "data/attempts-test.db";

describe("attempts/repo", () => {
  beforeEach(async () => {
    __resetDbCache();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const db = getDb(TEST_DB);
    seedProblems(db);
    await createUser(db, "u@example.com", "pw");
  });

  it("records and lists attempts for a problem", () => {
    const db = getDb(TEST_DB);
    const id = recordAttempt(db, {
      user_id: 1,
      problem_id: 1,
      code: "x",
      status: "passed",
      runtime_ms: 12,
      mode: "run",
    });
    expect(id).toBeGreaterThan(0);
    const list = listAttempts(db, 1, 1);
    expect(list.length).toBe(1);
    expect(list[0].status).toBe("passed");
  });
});
```

**Step 2:** Run, see RED.

**Step 3: Implement `lib/attempts/repo.ts`:**

```ts
import type Database from "better-sqlite3";

export type AttemptStatus = "passed" | "failed" | "error";

export type AttemptInput = {
  user_id: number;
  problem_id: number;
  code: string;
  status: AttemptStatus;
  runtime_ms: number | null;
  mode: string;
};

export type Attempt = AttemptInput & { id: number; created_at: number };

export function recordAttempt(
  db: Database.Database,
  input: AttemptInput,
): number {
  const info = db
    .prepare(
      `INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode)
       VALUES (@user_id, @problem_id, @code, @status, @runtime_ms, @mode)`,
    )
    .run(input);
  return Number(info.lastInsertRowid);
}

export function listAttempts(
  db: Database.Database,
  userId: number,
  problemId: number,
): Attempt[] {
  return db
    .prepare(
      `SELECT id, user_id, problem_id, code, status, runtime_ms, mode, created_at
       FROM attempts
       WHERE user_id = ? AND problem_id = ?
       ORDER BY created_at DESC`,
    )
    .all(userId, problemId) as Attempt[];
}
```

**Step 4:** Run, see GREEN.

**Step 5: Commit.**

```bash
git add lib/attempts/
git commit -m "feat: attempts repo (record + list)"
```

---

### Task 8: Problems list page

**Files:**
- Create: `app/problems/page.tsx`
- Modify: `app/page.tsx` (link to `/problems`)

**Step 1: Create `app/problems/page.tsx`:**

```tsx
import Link from "next/link";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";

export default function ProblemsPage() {
  const problems = listProblems(getDb());
  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Problems</h1>
      <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded">
        {problems.map((p) => (
          <li key={p.id}>
            <Link
              href={`/problem/${p.slug}`}
              className="flex items-center justify-between p-3 hover:bg-zinc-900"
            >
              <span>
                <span className="text-zinc-500 mr-2">{p.id}.</span>
                {p.title}
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
```

**Step 2: Modify `app/page.tsx`** — replace the default Next.js content with a minimal landing that links to `/problems`. Read it first, then replace the body.

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <Link
        href="/problems"
        className="px-4 py-2 rounded bg-white text-black font-medium"
      >
        Browse Problems →
      </Link>
    </main>
  );
}
```

**Step 3:** Build to make sure nothing broke:

```bash
npm run build 2>&1 | tail -10
```

**Step 4: Commit.**

```bash
git add app/problems/ app/page.tsx
git commit -m "feat: problems list page + home link"
```

---

### Task 9: Problem detail page (Monaco + runner)

**Files:**
- Create: `app/problem/[slug]/page.tsx` (server)
- Create: `app/problem/[slug]/problem-workspace.tsx` (client)
- Create: `app/problem/[slug]/actions.ts` (server action for submit)

**Step 1: Create `app/problem/[slug]/actions.ts`:**

```ts
"use server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { recordAttempt, type AttemptStatus } from "@/lib/attempts/repo";

export async function submitAttempt(input: {
  problemId: number;
  code: string;
  status: AttemptStatus;
  runtimeMs: number | null;
  mode: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = Number(session.user.id);
  return recordAttempt(getDb(), {
    user_id: userId,
    problem_id: input.problemId,
    code: input.code,
    status: input.status,
    runtime_ms: input.runtimeMs,
    mode: input.mode,
  });
}
```

**Step 2: Create `app/problem/[slug]/page.tsx`:**

```tsx
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getProblemBySlug } from "@/lib/problems/repo";
import { ProblemWorkspace } from "./problem-workspace";

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const problem = getProblemBySlug(getDb(), slug);
  if (!problem) notFound();
  return <ProblemWorkspace problem={problem} />;
}
```

**Step 3: Create `app/problem/[slug]/problem-workspace.tsx`:**

```tsx
"use client";
import { useState } from "react";
import type { Problem } from "@/lib/problems/types";
import { CodeEditor } from "@/components/code-editor";
import { usePyodideRunner } from "@/lib/pyodide/use-pyodide-runner";
import type { RunResult } from "@/lib/pyodide/worker-protocol";
import { submitAttempt } from "./actions";

export function ProblemWorkspace({ problem }: { problem: Problem }) {
  const [code, setCode] = useState(problem.starter_code);
  const [result, setResult] = useState<RunResult | null>(null);
  const { status, run, errorMsg } = usePyodideRunner();

  async function onRun() {
    const r = await run(
      code,
      JSON.stringify(problem.test_cases),
      problem.method_name,
    );
    setResult(r);
    const allPassed = r.compile_error === null && r.results.every((c) => c.passed);
    const totalMs = r.results.reduce((s, c) => s + c.elapsed_ms, 0);
    await submitAttempt({
      problemId: problem.id,
      code,
      status: r.compile_error
        ? "error"
        : allPassed
          ? "passed"
          : "failed",
      runtimeMs: totalMs,
      mode: "run",
    });
  }

  return (
    <main className="grid grid-cols-2 gap-4 h-screen p-4">
      <section className="overflow-auto pr-4 border-r border-zinc-800">
        <h1 className="text-2xl font-semibold mb-2">
          {problem.id}. {problem.title}
        </h1>
        <p className="text-xs uppercase tracking-wide text-zinc-500 mb-4">
          {problem.difficulty} · {problem.topic}
        </p>
        <article className="prose prose-invert max-w-none whitespace-pre-wrap">
          {problem.description_md}
        </article>
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex-1 border border-zinc-800 rounded overflow-hidden">
          <CodeEditor value={code} onChange={setCode} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRun}
            disabled={status !== "ready" && status !== "running"}
            className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
          >
            {status === "loading"
              ? "Loading Python…"
              : status === "running"
                ? "Running…"
                : "Run tests"}
          </button>
          {errorMsg && <span className="text-red-500 text-sm">{errorMsg}</span>}
        </div>
        <ResultsPanel result={result} />
      </section>
    </main>
  );
}

function ResultsPanel({ result }: { result: RunResult | null }) {
  if (!result) return null;
  if (result.compile_error) {
    return (
      <pre className="bg-red-950/40 border border-red-900 p-2 rounded text-sm overflow-auto max-h-64">
        {result.compile_error}
      </pre>
    );
  }
  return (
    <div className="space-y-1 max-h-64 overflow-auto">
      {result.results.map((c, i) => (
        <div
          key={i}
          className={`p-2 rounded text-sm border ${
            c.passed
              ? "border-emerald-900 bg-emerald-950/30"
              : "border-red-900 bg-red-950/30"
          }`}
        >
          <div className="flex justify-between">
            <span>Case {i + 1}: {c.passed ? "PASS" : "FAIL"}</span>
            <span className="text-zinc-500">{c.elapsed_ms} ms</span>
          </div>
          {!c.passed && (
            <pre className="mt-1 text-xs whitespace-pre-wrap">
              expected: {JSON.stringify(c.expected)}
              {"\n"}actual: {JSON.stringify(c.actual)}
              {c.error ? "\n" + c.error : ""}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Build:**

```bash
npm run build 2>&1 | tail -15
```
Expected: success. If Webpack chokes on the worker URL, try wrapping the `new Worker(...)` in a `useEffect`-only path (already done) and ensure the worker file uses `"use client"` is NOT needed (workers aren't React).

**Step 5: Extend the user's NextAuth session callback** so `session.user.id` is populated. In `auth.ts` add:

```ts
callbacks: {
  jwt({ token, user }) {
    if (user) token.uid = user.id;
    return token;
  },
  session({ session, token }) {
    if (session.user && token.uid) session.user.id = String(token.uid);
    return session;
  },
},
```

(Place inside the NextAuth config object alongside `providers`.)

**Step 6: Commit.**

```bash
git add app/problem/ auth.ts
git commit -m "feat: problem detail page with monaco + pyodide runner"
```

---

### Task 10: E2E — sign in, open problem, run starter code

**Files:**
- Create: `tests/e2e/problem-run.spec.ts`
- Modify: `playwright.config.ts` (add globalSetup + storageState)
- Create: `tests/e2e/global-setup.ts`

**Why:** The starter code returns `None` (`pass`) — Pyodide will report all cases failing, but it'll prove the entire pipeline (worker boot, harness call, results render, attempt persisted) works end-to-end.

**Step 1: Create a test user as part of setup.**

`tests/e2e/global-setup.ts`:

```ts
import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export default async function globalSetup(config: FullConfig) {
  // Ensure test user exists. We write a fixed credential into the dev db.
  const { getDb, __resetDbCache } = await import("../../lib/db");
  const { createUser, verifyPassword } = await import("../../lib/auth/users");
  __resetDbCache();
  const db = getDb();
  const exists = await verifyPassword(db, "e2e@example.com", "e2e-password-1");
  if (!exists) {
    try {
      await createUser(db, "e2e@example.com", "e2e-password-1");
    } catch {
      // already exists with a different password — fine
    }
  }

  // Sign in via UI and persist storageState
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  await page.goto(`${baseURL}/login`);
  await page.getByPlaceholder("Email").fill("e2e@example.com");
  await page.getByPlaceholder("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${baseURL}/`);
  const storagePath = path.join("tests/e2e/.auth/state.json");
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  await ctx.storageState({ path: storagePath });
  await browser.close();
}
```

**Step 2: Update `playwright.config.ts`:**

```ts
import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: path.resolve("tests/e2e/global-setup.ts"),
  use: {
    baseURL: "http://localhost:3000",
    storageState: "tests/e2e/.auth/state.json",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

**Step 3: Update the existing `tests/e2e/auth.spec.ts`** to NOT use storageState (it asserts the unauthenticated redirect):

```ts
test.use({ storageState: { cookies: [], origins: [] } });
```
Add at the top below the imports.

**Step 4: Add `tests/e2e/.auth` to `.gitignore`.**

**Step 5: Create `tests/e2e/problem-run.spec.ts`:**

```ts
import { test, expect } from "@playwright/test";

test("loads two-sum, runs starter code, sees fail results", async ({ page }) => {
  await page.goto("/problem/two-sum");
  await expect(page.getByRole("heading", { name: /Two Sum/ })).toBeVisible();

  // Wait for Pyodide to finish loading (button text changes from "Loading Python…" to "Run tests")
  const runBtn = page.getByRole("button", { name: /Run tests/ });
  await expect(runBtn).toBeEnabled({ timeout: 60_000 });

  await runBtn.click();

  // Either a Pass or Fail card appears for case 1
  await expect(page.getByText(/Case 1: (PASS|FAIL)/)).toBeVisible({
    timeout: 30_000,
  });
});
```

**Step 6: Run E2E.**

```bash
npx playwright test 2>&1 | tail -20
```
Expected: 2 passing (auth + problem-run).

If Pyodide loading times out, increase the `toBeEnabled` timeout or check that `/api/harness` returns the python source.

**Step 7: Commit.**

```bash
git add tests/e2e/ playwright.config.ts .gitignore
git commit -m "test: e2e for problem page + pyodide pipeline"
```

---

### Task 11: Final verification + commit

**Step 1:** Run everything green.

```bash
npm test && npx playwright test && npx tsc --noEmit && npm run lint
```

**Step 2:** Push.

```bash
git push origin main
```

**Step 3:** Manual smoke (you, in a browser) — sign in as your real user, open `/problems`, click Two Sum, write a real solution, run, verify both cases pass.

```python
class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
```

Expected: 2/2 PASS, attempt persisted (verify with `npx tsx -e "import('./lib/db').then(m => console.log(m.getDb().prepare('SELECT id,status,runtime_ms FROM attempts').all()))"`).

---

## Done Criteria

- `/problems` lists the 3 seeded problems
- `/problem/two-sum` loads, Monaco shows starter code, Pyodide boots, "Run tests" button enables
- Clicking Run executes the user code against test cases and shows per-case results
- Each run records an `attempts` row (status + runtime_ms) tied to the signed-in user
- All vitest + Playwright tests green
- Pushed to `origin/main`

## Out of scope (deferred to later steps)

- Custom test-case input box
- Submission vs. run distinction (UI button only — both modes record an attempt for now)
- AI chat panel (Step 4)
- Progress dashboard updates (Step 7)
