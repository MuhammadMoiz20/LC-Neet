# Step 1: Skeleton (Next.js + Auth + SQLite + NeetCode 150 Seed) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up a runnable Next.js app with single-user password auth, a SQLite database, and the NeetCode 150 problem catalog seeded into it.

**Architecture:** Next.js 15 App Router serves both UI and API routes. NextAuth (credentials provider) handles auth against a `users` table. SQLite via `better-sqlite3` stores everything in `data/app.db`. Problem data lives in `lib/problems/neetcode150.json` and is idempotently seeded on dev-server boot.

**Tech Stack:** Next.js 15, TypeScript, Tailwind 4, shadcn/ui, NextAuth v5, better-sqlite3, Zod, Vitest, Playwright, bcrypt.

## Commit Strategy

- Every task ends with a commit (already baked into each step below).
- **Backdating:** distribute commits consistently across the last 4 months (2025-12-25 → 2026-04-25), ~1 commit every 3-4 days on average, biased toward weekday evenings. Use `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` env vars per commit. A helper script (Task 0) generates the date sequence so each `git commit` in later tasks just consumes the next date.
- **Remote:** push to `https://github.com/MuhammadMoiz20/LC-Neet` (Task 12). Final push uses `--force-with-lease` only if needed; first push is plain `git push -u origin main`.

---

### Task 0: Backdated commit-date generator

**Files:**
- Create: `scripts/commit-dates.sh`, `.commit-dates`

**Step 1: Write `scripts/commit-dates.sh`**

```bash
#!/usr/bin/env bash
# Generates a sequence of evenly-spaced backdated commit timestamps
# from 2025-12-25 through 2026-04-24, biased to weekday evenings.
set -euo pipefail
START="2025-12-25"
END="2026-04-24"
COUNT=${1:-40}                   # ~1 commit every 3 days over 4 months
out=".commit-dates"
: > "$out"
start_epoch=$(date -j -f "%Y-%m-%d" "$START" "+%s")
end_epoch=$(date -j -f "%Y-%m-%d" "$END" "+%s")
range=$(( end_epoch - start_epoch ))
for i in $(seq 0 $((COUNT-1))); do
  frac=$(echo "scale=6; $i / ($COUNT - 1)" | bc)
  off=$(echo "$range * $frac / 1" | bc)
  ts=$(( start_epoch + off ))
  # Snap to a weekday evening (18:00-22:00) jittered
  hour=$(( 18 + (i % 5) ))
  min=$(( (i * 7) % 60 ))
  date -j -f "%s" "$ts" "+%Y-%m-%dT${hour}:${min}:00" >> "$out"
done
echo "Wrote $(wc -l < "$out") dates to $out"
```

Make executable: `chmod +x scripts/commit-dates.sh`.

**Step 2: Generate the dates**

```bash
./scripts/commit-dates.sh 40
head -5 .commit-dates
tail -5 .commit-dates
```
Expected: 40 lines spanning late Dec 2025 through late Apr 2026.

**Step 3: Add a tiny helper for consuming dates**

Append to `scripts/commit-dates.sh`:

```bash
# Usage: source scripts/commit-dates.sh && next_commit_date
next_commit_date() {
  local f=".commit-dates"
  local d
  d=$(head -1 "$f")
  tail -n +2 "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  echo "$d"
}
```

**Step 4: Replace every `git commit -m "..."` in subsequent tasks with**

```bash
D=$(./scripts/commit-dates.sh; head -1 .commit-dates) && \
  GIT_AUTHOR_DATE="$D" GIT_COMMITTER_DATE="$D" \
  git commit -m "..." && \
  tail -n +2 .commit-dates > .commit-dates.tmp && mv .commit-dates.tmp .commit-dates
```

Or simpler — define a shell function `bcommit` in your shell session:

```bash
bcommit() {
  local d=$(head -1 .commit-dates)
  GIT_AUTHOR_DATE="$d" GIT_COMMITTER_DATE="$d" git commit "$@"
  tail -n +2 .commit-dates > .commit-dates.tmp && mv .commit-dates.tmp .commit-dates
}
```

Then every later commit step uses `bcommit -m "..."` instead of `git commit -m "..."`.

**Step 5: Add `.commit-dates` to `.gitignore`**

```bash
echo ".commit-dates" >> .gitignore
```

(Don't commit yet — there's no repo state. This becomes part of Task 1's first commit.)

---

### Task 1: Initialize repo and Next.js app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/`, `.gitignore`, `README.md`

**Step 1: Initialize git**

Run from `/Users/moiz/Desktop/Projects/Personal/LC-Neet`:
```bash
git init -b main
```

**Step 2: Scaffold Next.js**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias="@/*" --use-npm --eslint --no-turbopack --yes
```

Expected: dependencies installed, `app/page.tsx` and friends generated.

**Step 3: Verify it boots**

```bash
npm run dev
```
Expected: `Ready on http://localhost:3000`. Visit it, see the default page. Ctrl+C.

**Step 4: Add `data/` to gitignore**

Append to `.gitignore`:
```
data/
.env.local
```

**Step 5: Commit**

```bash
git add -A
bcommit -m "chore: scaffold Next.js app"
```

---

### Task 2: Install runtime dependencies

**Step 1: Install**

```bash
npm install better-sqlite3 zod bcryptjs next-auth@beta
npm install -D @types/better-sqlite3 @types/bcryptjs vitest @vitest/ui happy-dom @playwright/test tsx
```

**Step 2: Verify install**

```bash
npm ls better-sqlite3 next-auth zod bcryptjs
```
Expected: all four show resolved versions, no UNMET errors.

**Step 3: Commit**

```bash
git add package.json package-lock.json
bcommit -m "chore: install runtime + test deps"
```

---

### Task 3: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` scripts

**Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

**Step 2: Add scripts to `package.json`**

In the `"scripts"` block:
```json
"test": "vitest run",
"test:watch": "vitest",
"seed": "tsx scripts/seed.ts"
```

**Step 3: Verify**

```bash
npx vitest run
```
Expected: `No test files found` (this is OK; means config loaded).

**Step 4: Commit**

```bash
git add vitest.config.ts package.json
bcommit -m "chore: configure vitest"
```

---

### Task 4: Database module (TDD)

**Files:**
- Create: `lib/db.ts`, `lib/db.test.ts`

**Step 1: Write failing test `lib/db.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "./db";
import fs from "node:fs";

const TEST_DB = "data/test.db";

describe("getDb", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it("creates schema on first call", () => {
    const db = getDb(TEST_DB);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain("users");
    expect(tables).toContain("problems");
    expect(tables).toContain("attempts");
    db.close();
  });

  it("is idempotent", () => {
    getDb(TEST_DB).close();
    expect(() => getDb(TEST_DB).close()).not.toThrow();
  });
});
```

**Step 2: Run test, verify it fails**

```bash
npx vitest run lib/db.test.ts
```
Expected: FAIL — `Cannot find module './db'`.

**Step 3: Implement `lib/db.ts`**

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK(difficulty IN ('Easy','Medium','Hard')),
  topic TEXT NOT NULL,
  neetcode_video_url TEXT,
  description_md TEXT NOT NULL,
  starter_code TEXT NOT NULL,
  test_cases_json TEXT NOT NULL,
  editorial_md TEXT
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  code TEXT NOT NULL,
  status TEXT NOT NULL,
  runtime_ms INTEGER,
  mode TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS attempts_user_problem ON attempts(user_id, problem_id);
`;

let cached: Database.Database | null = null;
let cachedPath: string | null = null;

export function getDb(filePath = "data/app.db"): Database.Database {
  if (cached && cachedPath === filePath) return cached;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  cached = db;
  cachedPath = filePath;
  return db;
}
```

**Step 4: Run test, verify pass**

```bash
npx vitest run lib/db.test.ts
```
Expected: 2 passing.

**Step 5: Commit**

```bash
git add lib/db.ts lib/db.test.ts
bcommit -m "feat: sqlite database module with schema"
```

---

### Task 5: Problem seed data fixture

**Files:**
- Create: `lib/problems/neetcode150.json` (minimal — 3 problems for now; full 150 is a separate data-import task)
- Create: `lib/problems/types.ts`

**Step 1: Write `lib/problems/types.ts`**

```ts
import { z } from "zod";

export const TestCase = z.object({
  input: z.unknown(),
  expected: z.unknown(),
});

export const Problem = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  topic: z.string(),
  neetcode_video_url: z.string().url().nullable(),
  description_md: z.string(),
  starter_code: z.string(),
  test_cases: z.array(TestCase),
  editorial_md: z.string().nullable(),
});

export type Problem = z.infer<typeof Problem>;
export const Problems = z.array(Problem);
```

**Step 2: Write `lib/problems/neetcode150.json`** (seed with 3 problems; full set imported later)

```json
[
  {
    "id": 1,
    "slug": "two-sum",
    "title": "Two Sum",
    "difficulty": "Easy",
    "topic": "Arrays & Hashing",
    "neetcode_video_url": "https://www.youtube.com/watch?v=KLlXCFG5TnA",
    "description_md": "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.",
    "starter_code": "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        pass\n",
    "test_cases": [
      { "input": { "nums": [2,7,11,15], "target": 9 }, "expected": [0,1] },
      { "input": { "nums": [3,2,4], "target": 6 }, "expected": [1,2] }
    ],
    "editorial_md": null
  },
  {
    "id": 2,
    "slug": "valid-anagram",
    "title": "Valid Anagram",
    "difficulty": "Easy",
    "topic": "Arrays & Hashing",
    "neetcode_video_url": "https://www.youtube.com/watch?v=9UtInBqnCgA",
    "description_md": "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`.",
    "starter_code": "class Solution:\n    def isAnagram(self, s: str, t: str) -> bool:\n        pass\n",
    "test_cases": [
      { "input": { "s": "anagram", "t": "nagaram" }, "expected": true },
      { "input": { "s": "rat", "t": "car" }, "expected": false }
    ],
    "editorial_md": null
  },
  {
    "id": 3,
    "slug": "contains-duplicate",
    "title": "Contains Duplicate",
    "difficulty": "Easy",
    "topic": "Arrays & Hashing",
    "neetcode_video_url": "https://www.youtube.com/watch?v=3OamzN90kPg",
    "description_md": "Given an integer array `nums`, return `true` if any value appears at least twice.",
    "starter_code": "class Solution:\n    def containsDuplicate(self, nums: list[int]) -> bool:\n        pass\n",
    "test_cases": [
      { "input": { "nums": [1,2,3,1] }, "expected": true },
      { "input": { "nums": [1,2,3,4] }, "expected": false }
    ],
    "editorial_md": null
  }
]
```

**Step 3: Validate fixture parses**

Quick sanity check via tsx:
```bash
npx tsx -e "import('./lib/problems/types.ts').then(m => { const data = require('./lib/problems/neetcode150.json'); console.log(m.Problems.parse(data).length, 'problems OK'); })"
```
Expected: `3 problems OK`.

**Step 4: Commit**

```bash
git add lib/problems/
bcommit -m "feat: problem schema + seed fixture (3 of 150)"
```

---

### Task 6: Seeder (TDD)

**Files:**
- Create: `lib/seed.ts`, `lib/seed.test.ts`, `scripts/seed.ts`

**Step 1: Write failing test `lib/seed.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb } from "./db";
import { seedProblems } from "./seed";

const TEST_DB = "data/seed-test.db";

describe("seedProblems", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it("inserts all problems", () => {
    const db = getDb(TEST_DB);
    seedProblems(db);
    const count = (db.prepare("SELECT COUNT(*) as c FROM problems").get() as any).c;
    expect(count).toBe(3);
    db.close();
  });

  it("is idempotent", () => {
    const db = getDb(TEST_DB);
    seedProblems(db);
    seedProblems(db);
    const count = (db.prepare("SELECT COUNT(*) as c FROM problems").get() as any).c;
    expect(count).toBe(3);
    db.close();
  });
});
```

**Step 2: Run, verify fail**

```bash
npx vitest run lib/seed.test.ts
```
Expected: FAIL — module not found.

**Step 3: Implement `lib/seed.ts`**

```ts
import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { Problems } from "./problems/types";

export function seedProblems(db: Database.Database) {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "lib/problems/neetcode150.json"),
    "utf8",
  );
  const problems = Problems.parse(JSON.parse(raw));
  const stmt = db.prepare(`
    INSERT INTO problems (id, slug, title, difficulty, topic, neetcode_video_url,
                          description_md, starter_code, test_cases_json, editorial_md)
    VALUES (@id, @slug, @title, @difficulty, @topic, @neetcode_video_url,
            @description_md, @starter_code, @test_cases_json, @editorial_md)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      difficulty=excluded.difficulty,
      topic=excluded.topic,
      neetcode_video_url=excluded.neetcode_video_url,
      description_md=excluded.description_md,
      starter_code=excluded.starter_code,
      test_cases_json=excluded.test_cases_json,
      editorial_md=excluded.editorial_md
  `);
  const tx = db.transaction((rows: typeof problems) => {
    for (const p of rows) {
      stmt.run({
        ...p,
        test_cases_json: JSON.stringify(p.test_cases),
      });
    }
  });
  tx(problems);
}
```

**Step 4: Run, verify pass**

```bash
npx vitest run lib/seed.test.ts
```
Expected: 2 passing.

**Step 5: Implement `scripts/seed.ts`**

```ts
import { getDb } from "../lib/db";
import { seedProblems } from "../lib/seed";

const db = getDb();
seedProblems(db);
const count = (db.prepare("SELECT COUNT(*) as c FROM problems").get() as any).c;
console.log(`Seeded ${count} problems.`);
db.close();
```

**Step 6: Run seeder against real DB**

```bash
npm run seed
```
Expected: `Seeded 3 problems.`

**Step 7: Commit**

```bash
git add lib/seed.ts lib/seed.test.ts scripts/seed.ts
bcommit -m "feat: idempotent problem seeder"
```

---

### Task 7: Auth — user creation script (TDD)

**Files:**
- Create: `lib/auth/users.ts`, `lib/auth/users.test.ts`, `scripts/create-user.ts`

**Step 1: Write failing test `lib/auth/users.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb } from "../db";
import { createUser, verifyPassword } from "./users";

const TEST_DB = "data/auth-test.db";

describe("auth/users", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it("creates a user with hashed password", async () => {
    const db = getDb(TEST_DB);
    const user = await createUser(db, "me@example.com", "hunter22");
    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe("me@example.com");
  });

  it("verifies correct password", async () => {
    const db = getDb(TEST_DB);
    await createUser(db, "me@example.com", "hunter22");
    expect(await verifyPassword(db, "me@example.com", "hunter22")).toBeTruthy();
    expect(await verifyPassword(db, "me@example.com", "wrong")).toBeNull();
  });
});
```

**Step 2: Run, verify fail**

```bash
npx vitest run lib/auth/users.test.ts
```
Expected: FAIL — module not found.

**Step 3: Implement `lib/auth/users.ts`**

```ts
import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";

export type User = { id: number; email: string };

export async function createUser(
  db: Database.Database,
  email: string,
  password: string,
): Promise<User> {
  const hash = await bcrypt.hash(password, 12);
  const info = db
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(email, hash);
  return { id: Number(info.lastInsertRowid), email };
}

export async function verifyPassword(
  db: Database.Database,
  email: string,
  password: string,
): Promise<User | null> {
  const row = db
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .get(email) as { id: number; email: string; password_hash: string } | undefined;
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  return ok ? { id: row.id, email: row.email } : null;
}
```

**Step 4: Run, verify pass**

```bash
npx vitest run lib/auth/users.test.ts
```
Expected: 2 passing.

**Step 5: Implement `scripts/create-user.ts`**

```ts
import { getDb } from "../lib/db";
import { createUser } from "../lib/auth/users";

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: tsx scripts/create-user.ts <email> <password>");
  process.exit(1);
}
const db = getDb();
createUser(db, email, password)
  .then((u) => console.log(`Created user ${u.email} (id=${u.id})`))
  .finally(() => db.close());
```

**Step 6: Commit**

```bash
git add lib/auth/ scripts/create-user.ts
bcommit -m "feat: user creation + password verification"
```

---

### Task 8: NextAuth wiring (credentials provider)

**Files:**
- Create: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `middleware.ts`, `app/login/page.tsx`, `.env.local`

**Step 1: Generate auth secret**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output.

**Step 2: Write `.env.local`**

```
AUTH_SECRET=<paste from step 1>
AUTH_URL=http://localhost:3000
```

**Step 3: Write `auth.ts`** (project root)

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const user = await verifyPassword(getDb(), email, password);
        return user ? { id: String(user.id), email: user.email } : null;
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
});
```

**Step 4: Write `app/api/auth/[...nextauth]/route.ts`**

```ts
export { GET, POST } from "@/auth";
```

Wait — NextAuth v5 exports handlers differently. Use:

```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

**Step 5: Write `middleware.ts`** (protect everything except `/login` and auth API)

```ts
import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) return;
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 6: Write `app/login/page.tsx`**

```tsx
"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) setErr("Invalid credentials");
    else window.location.href = "/";
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <input className="w-full border p-2 rounded" type="email" placeholder="Email"
               value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full border p-2 rounded" type="password" placeholder="Password"
               value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="w-full bg-black text-white p-2 rounded" type="submit">Sign in</button>
      </form>
    </main>
  );
}
```

Wrap the app for `signIn` to work — also add `app/providers.tsx`:

```tsx
"use client";
import { SessionProvider } from "next-auth/react";
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

And modify `app/layout.tsx` to wrap `{children}` in `<Providers>`.

**Step 7: Boot and manually verify**

```bash
npm run seed
npx tsx scripts/create-user.ts moizzahid20@gmail.com <choose-a-password>
npm run dev
```

Visit `http://localhost:3000` → should redirect to `/login`. Sign in → should land on `/`. Expected: works.

**Step 8: Commit**

```bash
git add auth.ts app/ middleware.ts .env.local.example
bcommit -m "feat: NextAuth credentials auth + login page + middleware"
```

(Note: do NOT commit `.env.local`. Create `.env.local.example` with placeholder values instead and commit that.)

---

### Task 9: Boot-time seed hook

**Files:**
- Modify: `app/layout.tsx` (or create `instrumentation.ts`)

**Step 1: Create `instrumentation.ts` at project root**

Next.js calls this once on server boot.

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db");
    const { seedProblems } = await import("./lib/seed");
    seedProblems(getDb());
  }
}
```

**Step 2: Enable instrumentation in `next.config.ts`**

```ts
const nextConfig = {
  experimental: { instrumentationHook: true },
};
export default nextConfig;
```

(Note: if Next.js 15 has instrumentation on by default, this flag is unnecessary — try without first.)

**Step 3: Verify on boot**

```bash
rm -f data/app.db
npm run dev
```
Then in another terminal:
```bash
sqlite3 data/app.db "SELECT COUNT(*) FROM problems;"
```
Expected: `3`.

**Step 4: Commit**

```bash
git add instrumentation.ts next.config.ts
bcommit -m "feat: seed problems on server boot"
```

---

### Task 10: Smoke E2E with Playwright

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/auth.spec.ts`

**Step 1: Init Playwright**

```bash
npx playwright install chromium
```

**Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

**Step 3: Write `tests/e2e/auth.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("redirects unauthenticated user to /login", async ({ page }) => {
  const res = await page.goto("/");
  expect(page.url()).toContain("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
```

**Step 4: Run**

```bash
npx playwright test
```
Expected: 1 passing.

**Step 5: Add npm script**

In `package.json`:
```json
"e2e": "playwright test"
```

**Step 6: Commit**

```bash
git add playwright.config.ts tests/ package.json
bcommit -m "test: e2e smoke for unauthenticated redirect"
```

---

### Task 11: README and final verification

**Files:**
- Modify: `README.md`

**Step 1: Write `README.md`**

````markdown
# LC-Neet

Personal NeetCode 150 trainer with AI coach. See `docs/plans/2026-04-25-leetcode-neetcode-clone-design.md`.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in AUTH_SECRET
npx tsx scripts/create-user.ts you@example.com yourpassword
npm run dev
```

## Scripts

- `npm run dev` — start app
- `npm run seed` — seed problems
- `npm test` — unit tests
- `npm run e2e` — Playwright tests
````

**Step 2: Run all checks**

```bash
npm test && npm run e2e
```
Expected: all green.

**Step 3: Commit**

```bash
git add README.md
bcommit -m "docs: README"
```

---

### Task 12: Push to GitHub

**Files:** none changed; this is git plumbing.

**Step 1: Confirm remote URL doesn't already exist locally**

```bash
git remote -v
```
Expected: empty (no `origin`).

**Step 2: Add remote**

```bash
git remote add origin https://github.com/MuhammadMoiz20/LC-Neet.git
```

**Step 3: Verify the GitHub repo exists and you can authenticate**

```bash
gh auth status
gh repo view MuhammadMoiz20/LC-Neet --json name,visibility -q '.name + " (" + .visibility + ")"'
```

If repo doesn't exist:
```bash
gh repo create MuhammadMoiz20/LC-Neet --private --source=. --remote=origin
```
(skip the `git remote add` above if you use this — `gh repo create` adds it.)

**Step 4: Verify backdated history looks right**

```bash
git log --pretty=format:"%h %ad %s" --date=short | head -20
git log --pretty=format:"%ad" --date=short | sort | uniq -c | head
```
Expected: dates spread roughly evenly across 2025-12 → 2026-04, no clustering on 2026-04-25.

**Step 5: Push**

```bash
git push -u origin main
```
Expected: branch `main` set up to track `origin/main`. If the remote already has commits and rejects, **stop and confirm with the user** before any force push — never `--force` to a remote without explicit go-ahead.

**Step 6: Verify on GitHub**

```bash
gh repo view MuhammadMoiz20/LC-Neet --web
```
Check the contributions calendar shows activity spread over the last 4 months. (Note: GitHub only counts commits toward your contribution graph if the commit author email matches a verified email on your GitHub account — verify your `git config user.email` matches one before Task 1.)

**No commit needed for this task** (push only).

---

## Done Criteria

- `npm test` → all unit tests pass
- `npm run e2e` → smoke test passes
- `npm run dev` → can sign in with seeded user, lands on `/`
- `data/app.db` contains 3 seeded problems
- Visiting `/` while signed out redirects to `/login`
- Repo pushed to `https://github.com/MuhammadMoiz20/LC-Neet` with commit history spread across 2025-12 → 2026-04
- **Pre-Task-1 check:** `git config user.email` matches a verified email on the MuhammadMoiz20 GitHub account (otherwise contribution graph won't credit the backdated commits)

## Next Steps (out of scope for this plan)

- Step 2 of build order: Problem page, Monaco editor, Pyodide runner — separate plan
- Full NeetCode 150 dataset import — separate one-off task
