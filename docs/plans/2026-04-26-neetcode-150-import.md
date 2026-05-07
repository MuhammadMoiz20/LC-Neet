# NeetCode 150 Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Populate `lib/problems/neetcode150.json` with all 150 NeetCode problems — verbatim LeetCode descriptions, NeetCode YouTube video URLs, Python starter code, and runnable Pyodide test cases — and surface the videos in the problem workspace.

**Architecture:** Two checked-in static JSON files drive everything. `scripts/neetcode-150-index.json` is a hand-curated index of {id, slug, title, difficulty, topic, neetcode_video_url} for all 150 entries. `scripts/import-neetcode-150.ts` reads that index, fetches each LeetCode problem via the public GraphQL endpoint (`https://leetcode.com/graphql/`), converts the HTML body to markdown (Turndown), derives `starter_code`/`method_name` from the `python3` snippet + `metaData`, parses the rendered "Example" blocks into `test_cases`, validates the result with the existing `Problems` Zod schema, and writes `lib/problems/neetcode150.json`. The existing `seedProblems` pipeline (`pnpm seed`) loads it into SQLite — no DB schema changes. Copyright is not a concern: this app is private/non-published per the user's stated intent.

**Tech Stack:** Next.js 16, TypeScript, Zod 4, better-sqlite3 (existing). New dev deps: `turndown`, `node-html-parser`, `@types/turndown`. Run via `tsx`.

---

## Pre-flight

**Conventions used in this plan:**
- Run all package commands with `pnpm` (per `packageManager` field).
- Use the existing `Problem` schema in `lib/problems/types.ts` as the single source of truth — do **not** add fields.
- Slugs match LeetCode's `titleSlug` (e.g. `two-sum`, `valid-anagram`). Existing 3 rows already follow this.
- The importer must be **idempotent** and **merge** — re-running must not clobber hand-fixed rows.
- Per `AGENTS.md`, this is a non-stock Next.js — but everything in this plan is plain TS scripts and a single `<iframe>`, so framework specifics don't apply.

---

### Task 1: Install dev dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install**

Run:
```bash
pnpm add -D turndown @types/turndown node-html-parser
```

Expected: `package.json` gains the three deps under `devDependencies`. No runtime deps change.

**Step 2: Verify**

Run: `pnpm ls turndown node-html-parser`
Expected: both versions print, no peer-warning errors.

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add turndown + node-html-parser for NC150 import script"
```

---

### Task 2: Create the canonical NeetCode-150 index file

**Files:**
- Create: `scripts/neetcode-150-index.json`

This is the only manually-curated input. It lists the 150 problems with the metadata that doesn't come from LeetCode (topic grouping + NeetCode video URL).

**Step 1: Author the index**

Source of truth for ordering, topic, and video URL: NeetCode's public roadmap (https://neetcode.io/practice → "NeetCode 150"). Each entry is one object:

```json
{
  "id": 1,
  "slug": "two-sum",
  "title": "Two Sum",
  "difficulty": "Easy",
  "topic": "Arrays & Hashing",
  "neetcode_video_url": "https://www.youtube.com/watch?v=KLlXCFG5TnA"
}
```

Constraints (the importer will assert these):
- Exactly 150 entries.
- `id` strictly increases from 1 (preserve the existing 3 IDs for `two-sum`, `valid-anagram`, `contains-duplicate`).
- `topic` must be one of the keys in `TOPIC_TO_PATTERN` in `lib/patterns/groups.ts:31` (e.g. "Arrays & Hashing", "Two Pointers", "Sliding Window", "Stack", "Binary Search", "Linked List", "Trees", "Tries", "Heap / Priority Queue", "Backtracking", "Graphs", "Advanced Graphs", "1-D DP", "2-D DP", "Greedy", "Intervals", "Math & Geometry", "Bit Manipulation").
- The per-topic counts must match `PATTERN_GROUPS` totals in `lib/patterns/groups.ts:10` (9 + 5 + 6 + 7 + 7 + 11 + 15 + 3 + 7 + 9 + 13 + 6 + 12 + 11 + 8 + 6 + 8 + 7 = 150).
- Every `neetcode_video_url` must be a valid `https://www.youtube.com/watch?v=…` URL.

**Step 2: Validate counts with a one-liner**

Run:
```bash
pnpm tsx -e "const d=require('./scripts/neetcode-150-index.json');const c={};for(const p of d)c[p.topic]=(c[p.topic]||0)+1;console.log(d.length,c)"
```
Expected: `150` and a per-topic object matching the totals above.

**Step 3: Commit**

```bash
git add scripts/neetcode-150-index.json
git commit -m "feat(data): add canonical NeetCode 150 index (slug, topic, video)"
```

---

### Task 3: Write a failing test for the importer's HTML→markdown helper

**Files:**
- Create: `scripts/import-neetcode-150.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { htmlToMarkdown, parseExamples, deriveStarter } from "./import-neetcode-150";

describe("htmlToMarkdown", () => {
  it("converts <code> and <strong> while preserving newlines around examples", () => {
    const html = `<p>Given <code>nums</code>, return <strong>indices</strong>.</p>
<p><strong>Example 1:</strong></p>
<pre>Input: nums = [2,7,11,15], target = 9
Output: [0,1]</pre>`;
    const md = htmlToMarkdown(html);
    expect(md).toContain("`nums`");
    expect(md).toContain("**indices**");
    expect(md).toContain("Input: nums = [2,7,11,15], target = 9");
    expect(md).toContain("Output: [0,1]");
  });
});

describe("parseExamples", () => {
  it("extracts {input, expected} pairs from rendered example blocks", () => {
    const md = `Some text.

**Example 1:**

\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
\`\`\`

**Example 2:**

\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\`
`;
    const cases = parseExamples(md, ["nums", "target"]);
    expect(cases).toEqual([
      { input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
      { input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2] },
    ]);
  });
});

describe("deriveStarter", () => {
  it("rewrites a LeetCode python3 snippet into our class Solution stub", () => {
    const snippet = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        `;
    const { starter, methodName } = deriveStarter(snippet);
    expect(methodName).toBe("twoSum");
    expect(starter).toContain("class Solution:");
    expect(starter).toContain("def twoSum(self, nums: List[int], target: int) -> List[int]:");
    expect(starter.trimEnd().endsWith("pass")).toBe(true);
  });
});
```

**Step 2: Run it to verify it fails**

Run: `pnpm vitest run scripts/import-neetcode-150.test.ts`
Expected: FAIL with `Cannot find module './import-neetcode-150'`.

**Step 3: Commit**

```bash
git add scripts/import-neetcode-150.test.ts
git commit -m "test: failing tests for NC150 importer helpers"
```

---

### Task 4: Implement the three helpers to make the test pass

**Files:**
- Create: `scripts/import-neetcode-150.ts`

**Step 1: Implement only what the tests need (not the fetcher yet)**

```ts
import TurndownService from "turndown";

const td = new TurndownService({ codeBlockStyle: "fenced", emDelimiter: "*" });
// Keep <pre> blocks as fenced code so example I/O stays parseable.
td.addRule("pre", {
  filter: "pre",
  replacement: (content) => "\n```\n" + content.replace(/^\n+|\n+$/g, "") + "\n```\n",
});

export function htmlToMarkdown(html: string): string {
  return td.turndown(html).replace(/ /g, " ");
}

export type TestCase = { input: Record<string, unknown>; expected: unknown };

export function parseExamples(md: string, paramNames: string[]): TestCase[] {
  const blocks = [...md.matchAll(/```\s*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  const cases: TestCase[] = [];
  for (const block of blocks) {
    const inMatch = block.match(/Input:\s*(.+?)(?=\n\s*Output:|$)/s);
    const outMatch = block.match(/Output:\s*(.+?)(?=\n\s*Explanation:|$)/s);
    if (!inMatch || !outMatch) continue;
    const input: Record<string, unknown> = {};
    // Split on top-level ", <name> = " boundaries.
    const re = new RegExp(`(${paramNames.join("|")})\\s*=\\s*`, "g");
    const parts = inMatch[1].split(re).filter(Boolean);
    for (let i = 0; i < parts.length; i += 2) {
      const name = parts[i].trim();
      const rawVal = parts[i + 1]?.replace(/,\s*$/, "").trim();
      if (!name || rawVal === undefined) continue;
      input[name] = jsonish(rawVal);
    }
    cases.push({ input, expected: jsonish(outMatch[1].trim()) });
  }
  return cases;
}

function jsonish(s: string): unknown {
  // LeetCode prints arrays/numbers/booleans/strings in a JSON-compatible way.
  // Single-quoted strings → double-quoted. true/false/null pass through.
  const normalized = s
    .replace(/'/g, '"')
    .replace(/\bnull\b/g, "null");
  try {
    return JSON.parse(normalized);
  } catch {
    return s; // fall back to raw string; humans can fix per-problem if needed.
  }
}

export function deriveStarter(pythonSnippet: string): { starter: string; methodName: string } {
  const sig = pythonSnippet.match(/def\s+(\w+)\s*\(self[^)]*\)\s*(->\s*[^:]+)?:/);
  if (!sig) throw new Error("could not parse python3 snippet: " + pythonSnippet.slice(0, 80));
  const methodName = sig[1];
  const lines = pythonSnippet.split("\n");
  const defIdx = lines.findIndex((l) => l.includes(`def ${methodName}`));
  const starter = ["class Solution:", lines[defIdx], "        pass", ""].join("\n");
  return { starter, methodName };
}
```

**Step 2: Run the helper tests**

Run: `pnpm vitest run scripts/import-neetcode-150.test.ts`
Expected: 3 tests pass.

**Step 3: Commit**

```bash
git add scripts/import-neetcode-150.ts
git commit -m "feat(scripts): NC150 importer helpers (html→md, examples, starter)"
```

---

### Task 5: Add the LeetCode fetcher and main entry point

**Files:**
- Modify: `scripts/import-neetcode-150.ts`

**Step 1: Append the fetcher + main function**

```ts
// --- LeetCode fetcher ---

const QUERY = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    title
    content
    metaData
    codeSnippets { lang langSlug code }
    exampleTestcases
  }
}`;

async function fetchLC(slug: string): Promise<{
  content: string;
  metaData: { name: string; params: { name: string; type: string }[] };
  python3: string;
}> {
  const res = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "lcneet-importer/1.0",
      referer: `https://leetcode.com/problems/${slug}/`,
    },
    body: JSON.stringify({ query: QUERY, variables: { titleSlug: slug } }),
  });
  if (!res.ok) throw new Error(`LC ${slug}: HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { question: any } };
  const q = json.data?.question;
  if (!q) throw new Error(`LC ${slug}: empty response`);
  const py = (q.codeSnippets ?? []).find((s: any) => s.langSlug === "python3");
  if (!py) throw new Error(`LC ${slug}: no python3 snippet`);
  return { content: q.content, metaData: JSON.parse(q.metaData), python3: py.code };
}

// --- main ---

import fs from "node:fs";
import path from "node:path";
import { Problems, type Problem } from "../lib/problems/types";

type IndexRow = {
  id: number; slug: string; title: string;
  difficulty: "Easy" | "Medium" | "Hard"; topic: string; neetcode_video_url: string;
};

async function main() {
  const indexPath = path.join(process.cwd(), "scripts/neetcode-150-index.json");
  const outPath = path.join(process.cwd(), "lib/problems/neetcode150.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as IndexRow[];
  if (index.length !== 150) throw new Error(`index has ${index.length} entries, expected 150`);

  // Merge: keep existing rows verbatim unless --refetch=<slug,…> is passed.
  const existing: Problem[] = fs.existsSync(outPath)
    ? Problems.parse(JSON.parse(fs.readFileSync(outPath, "utf8")))
    : [];
  const existingBySlug = new Map(existing.map((p) => [p.slug, p]));
  const refetch = new Set(
    (process.argv.find((a) => a.startsWith("--refetch="))?.slice(10) ?? "")
      .split(",").filter(Boolean),
  );

  const out: Problem[] = [];
  const failures: { slug: string; reason: string }[] = [];

  for (const row of index) {
    const cached = existingBySlug.get(row.slug);
    if (cached && !refetch.has(row.slug) && !refetch.has("ALL")) {
      out.push({ ...cached, ...row, neetcode_video_url: row.neetcode_video_url });
      continue;
    }
    try {
      const { content, metaData, python3 } = await fetchLC(row.slug);
      const description_md = htmlToMarkdown(content);
      const { starter, methodName } = deriveStarter(python3);
      const paramNames = (metaData.params ?? []).map((p) => p.name);
      const cases = parseExamples(description_md, paramNames);
      out.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        difficulty: row.difficulty,
        topic: row.topic,
        neetcode_video_url: row.neetcode_video_url,
        description_md,
        starter_code: starter,
        test_cases: cases.length ? cases : [{ input: {}, expected: null }],
        editorial_md: null,
        method_name: methodName ?? metaData.name,
      });
      if (cases.length === 0) failures.push({ slug: row.slug, reason: "no test cases parsed" });
      await new Promise((r) => setTimeout(r, 350)); // be polite to LC
    } catch (e) {
      failures.push({ slug: row.slug, reason: (e as Error).message });
      // Keep prior row if we had one, otherwise skip; never write a partial.
      if (cached) out.push({ ...cached, ...row });
    }
  }

  // Validate before writing so we never produce an invalid file.
  Problems.parse(out);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

  console.log(`wrote ${out.length} problems to ${outPath}`);
  if (failures.length) {
    console.log(`\n${failures.length} need manual attention:`);
    for (const f of failures) console.log(`  - ${f.slug}: ${f.reason}`);
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

**Step 2: Re-run the helper tests to ensure nothing regressed**

Run: `pnpm vitest run scripts/import-neetcode-150.test.ts`
Expected: 3 pass.

**Step 3: Commit**

```bash
git add scripts/import-neetcode-150.ts
git commit -m "feat(scripts): LeetCode fetcher + main loop for NC150 import"
```

---

### Task 6: Add an npm script and run a 1-problem dry run

**Files:**
- Modify: `package.json` — add `"import:nc150": "tsx scripts/import-neetcode-150.ts"`.

**Step 1: Add the script**

Edit `package.json` `scripts` block to include:
```json
"import:nc150": "tsx scripts/import-neetcode-150.ts"
```

**Step 2: Dry-run with one slug only**

Temporarily back up `scripts/neetcode-150-index.json` and create a 1-row variant containing only `two-sum`. Run:
```bash
cp scripts/neetcode-150-index.json scripts/neetcode-150-index.json.bak
pnpm tsx -e "const d=require('./scripts/neetcode-150-index.json.bak');require('fs').writeFileSync('scripts/neetcode-150-index.json',JSON.stringify(d.slice(0,1),null,2))"
pnpm import:nc150 -- --refetch=ALL
```
Expected log: `wrote 1 problems …`. Open `lib/problems/neetcode150.json` and confirm `two-sum` now has the full LeetCode description (multi-paragraph), the original starter, and ≥2 test cases. The 2 other existing rows (`valid-anagram`, `contains-duplicate`) will have been dropped — that is fine, we restore in step 3.

**Step 3: Restore the full index**

```bash
mv scripts/neetcode-150-index.json.bak scripts/neetcode-150-index.json
```

**Step 4: Reset the test artifact (do not commit the dry-run JSON)**

```bash
git checkout -- lib/problems/neetcode150.json
```

**Step 5: Commit only the script**

```bash
git add package.json
git commit -m "chore: add pnpm import:nc150 script"
```

---

### Task 7: Run the full import for all 150

**Files:**
- Modify: `lib/problems/neetcode150.json` (regenerated)

**Step 1: Run**

Run: `pnpm import:nc150 -- --refetch=ALL`
Expected: takes ~1 min (150 × 350 ms). Final log:
- `wrote 150 problems to …/neetcode150.json`
- A list of slugs with parse failures. Tree/linked-list problems (`reverse-linked-list`, `invert-binary-tree`, `binary-tree-level-order-traversal`, etc.) and problems with non-array inputs are likely to need manual fixes — that is expected.

**Step 2: Validate the file**

Run:
```bash
pnpm tsx -e "const {Problems}=require('./lib/problems/types');const d=require('./lib/problems/neetcode150.json');Problems.parse(d);console.log('ok',d.length)"
```
Expected: `ok 150`.

**Step 3: Commit the data**

```bash
git add lib/problems/neetcode150.json
git commit -m "feat(data): import all 150 NeetCode problems from LeetCode"
```

---

### Task 8: Add a JSON-shape integrity test (locks in invariants going forward)

**Files:**
- Create: `lib/problems/neetcode150.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import data from "./neetcode150.json";
import { Problems } from "./types";
import { PATTERN_GROUPS, topicToPatternId } from "../patterns/groups";

const problems = Problems.parse(data);

describe("neetcode150.json", () => {
  it("has exactly 150 unique problems", () => {
    expect(problems).toHaveLength(150);
    expect(new Set(problems.map((p) => p.slug)).size).toBe(150);
    expect(new Set(problems.map((p) => p.id)).size).toBe(150);
  });

  it("every problem has a YouTube video URL", () => {
    for (const p of problems) {
      expect(p.neetcode_video_url, p.slug).toMatch(/youtube\.com\/watch\?v=/);
    }
  });

  it("every problem has at least one test case with a non-empty input", () => {
    for (const p of problems) {
      expect(p.test_cases.length, p.slug).toBeGreaterThan(0);
      const first = p.test_cases[0].input as Record<string, unknown>;
      expect(Object.keys(first).length, p.slug).toBeGreaterThan(0);
    }
  });

  it("every topic maps to a known pattern group and counts match", () => {
    const counts = new Map<string, number>();
    for (const p of problems) {
      const id = topicToPatternId(p.topic);
      expect(PATTERN_GROUPS.find((g) => g.id === id), p.slug).toBeTruthy();
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const g of PATTERN_GROUPS) {
      expect(counts.get(g.id) ?? 0, g.id).toBe(g.total);
    }
  });

  it("starter_code defines class Solution with the declared method_name", () => {
    for (const p of problems) {
      expect(p.starter_code, p.slug).toContain("class Solution:");
      expect(p.starter_code, p.slug).toContain(`def ${p.method_name}(`);
    }
  });
});
```

**Step 2: Run**

Run: `pnpm vitest run lib/problems/neetcode150.test.ts`
Expected: all 5 tests pass. **If any fail, that slug needs manual fixing in `neetcode150.json`** — the test is the worklist for Task 9.

**Step 3: Commit**

```bash
git add lib/problems/neetcode150.test.ts
git commit -m "test: lock invariants on neetcode150.json (counts, videos, cases)"
```

---

### Task 9: Manually fix problems flagged by Task 7 / Task 8

**Files:**
- Modify: `lib/problems/neetcode150.json` (targeted edits per slug)

For each slug printed by the importer or test:
1. Open the LeetCode page (`https://leetcode.com/problems/<slug>/`) and the existing entry in `neetcode150.json`.
2. **Tree/linked-list problems:** LeetCode's `metaData.return.type` is `TreeNode`/`ListNode`; we model these the same way LC serializes them — arrays. Author 2–3 test cases by hand using LC's serialization (e.g. `[3,9,20,null,null,15,7]` for trees, `[1,2,3]` for linked lists). Document the convention in a one-line comment at the top of the affected `starter_code` so the Pyodide runner knows to deserialize. Example for `reverse-linked-list`:
   ```json
   "test_cases": [
     { "input": { "head": [1,2,3,4,5] }, "expected": [5,4,3,2,1] },
     { "input": { "head": [] }, "expected": [] }
   ]
   ```
3. **Multi-line/string-quote inputs** (e.g. `valid-parentheses` with `"()[]{}"`): verify `parseExamples` got the unescaping right; correct the JSON if not.
4. **Design problems** (`lru-cache`, `min-stack`, `implement-trie`): these don't fit the `{input, expected}` shape. For now, set `test_cases` to a single placeholder `[{ "input": { "operations": [], "args": [] }, "expected": [] }]` and add a TODO note in `editorial_md`. Wiring the design-problem runner is out of scope for this plan — file a follow-up.
5. After each batch of fixes, re-run `pnpm vitest run lib/problems/neetcode150.test.ts` until green.

**Step 1: Iterate**

Run: `pnpm vitest run lib/problems/neetcode150.test.ts`
Fix → re-run until all green.

**Step 2: Commit in topical batches**

```bash
git add lib/problems/neetcode150.json
git commit -m "fix(data): hand-correct linked-list problem test cases"
# (repeat per batch: trees, design, etc.)
```

---

### Task 10: Re-seed the dev DB and smoke-test the UI

**Files:** none modified.

**Step 1: Seed**

Run: `pnpm seed`
Expected: `Seeded 150 problems.`

**Step 2: Boot the dev server**

Run (background): `pnpm dev`

**Step 3: Smoke-test**

Open `http://localhost:3000/problems`. Expected: the table shows 150 rows, the pattern facet shows the 18 NeetCode pattern groups with the counts from `PATTERN_GROUPS`, and clicking any row routes to `/problem/<slug>` and renders the imported description.

**Step 4: Stop the dev server, commit nothing (no file changes)**

---

### Task 11: Render the NeetCode video on the problem page

**Files:**
- Modify: `app/(app)/problem/[slug]/problem-workspace.tsx` (add a YouTube embed in the prompt rail).
- Create: `components/problems/youtube-embed.tsx`.

**Step 1: Add a failing component test**

Create `components/problems/youtube-embed.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { YouTubeEmbed } from "./youtube-embed";

describe("YouTubeEmbed", () => {
  it("renders an iframe with the extracted video id", () => {
    const { container } = render(
      <YouTubeEmbed url="https://www.youtube.com/watch?v=KLlXCFG5TnA" />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toContain("/embed/KLlXCFG5TnA");
  });

  it("renders nothing when url is null", () => {
    const { container } = render(<YouTubeEmbed url={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

Run: `pnpm vitest run components/problems/youtube-embed.test.tsx`
Expected: FAIL — module not found. (If `@testing-library/react` is missing, install it with `pnpm add -D @testing-library/react @testing-library/dom`.)

**Step 2: Implement**

Create `components/problems/youtube-embed.tsx`:

```tsx
export function YouTubeEmbed({ url }: { url: string | null }) {
  if (!url) return null;
  const id = new URL(url).searchParams.get("v");
  if (!id) return null;
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-zinc-800">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="NeetCode walkthrough"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
```

Run the test again. Expected: PASS.

**Step 3: Wire it into the workspace**

In `app/(app)/problem/[slug]/problem-workspace.tsx`, import `YouTubeEmbed` and render `<YouTubeEmbed url={problem.neetcode_video_url} />` in a collapsible "Walkthrough" section of the prompt rail (per the redesign doc at `docs/plans/2026-04-25-step2-problem-page-pyodide.md` and the `Prompt rail (left, collapsible)` spec in the design plan). Default state: collapsed, so the editor stays the focal point.

**Step 4: Manual verification**

`pnpm dev` → `http://localhost:3000/problem/two-sum` → expand walkthrough → video plays.

**Step 5: Commit**

```bash
git add components/problems/youtube-embed.tsx components/problems/youtube-embed.test.tsx app/\(app\)/problem/\[slug\]/problem-workspace.tsx
git commit -m "feat(ui): NeetCode video embed in problem workspace"
```

---

### Task 12: Final verification

**Step 1:** `pnpm lint` → no new warnings.
**Step 2:** `pnpm test` → all green (existing + new tests).
**Step 3:** `pnpm build` → succeeds.
**Step 4:** Open `/`, `/problems`, and 3 random `/problem/<slug>` pages. Confirm pattern counts on the homepage rail equal `PATTERN_GROUPS` totals.

**Step 5: Final commit only if anything changed.** Otherwise stop here.

---

## Out of scope / follow-ups

- Design-problem runner (LRU Cache, MinStack, Trie, etc.) — needs a different test-case shape and a different Pyodide harness. File as a separate plan.
- Rich serializers for `TreeNode`/`ListNode` in the runner so test cases can use plain LC array notation transparently. Currently the per-problem `starter_code` is expected to handle deserialization.
- Editorials (`editorial_md`) — left null; can be back-filled later from NeetCode write-ups or generated from the coach.
- A periodic re-import is **not** scheduled — `neetcode150.json` is treated as a static seed.
