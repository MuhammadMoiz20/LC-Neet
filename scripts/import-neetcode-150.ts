import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import TurndownService from "turndown";
import { Problem, Problems } from "../lib/problems/types";

export type TestCase = { input: Record<string, unknown>; expected: unknown };

/**
 * Convert LeetCode-flavoured HTML into Markdown.
 *
 * - Uses fenced code blocks and `*` for emphasis.
 * - Renders `<pre>` blocks as fenced code blocks so example I/O survives intact.
 * - Strips non-breaking spaces (U+00A0), which LeetCode emits liberally and
 *   which otherwise leak through as visible-but-not-typeable whitespace.
 */
export function htmlToMarkdown(html: string): string {
  const service = new TurndownService({
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });

  service.addRule("preAsFencedCode", {
    filter: ["pre"],
    replacement: (_content, node) => {
      const text = (node as HTMLElement).textContent ?? "";
      return `\n\n\`\`\`\n${text.replace(/ /g, " ").trimEnd()}\n\`\`\`\n\n`;
    },
  });

  const md = service.turndown(html);
  return md.replace(/ /g, " ");
}

/**
 * Best-effort JSON coercion: tolerate single-quoted strings and fall back to
 * the raw trimmed string if `JSON.parse` cannot make sense of the value.
 */
function coerceValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try swapping single quotes for double quotes (common in LC examples).
    try {
      return JSON.parse(trimmed.replace(/'/g, '"'));
    } catch {
      return trimmed;
    }
  }
}

/**
 * Extract `{ input, expected }` pairs from rendered example blocks.
 *
 * Handles both the older fenced-code-block format and the modern inline
 * `**Input:**` / `**Output:**` paragraph format LeetCode uses today. For each
 * example, splits the input on top-level `<paramName> = ` boundaries (using
 * the supplied `paramNames`).
 */
export function parseExamples(md: string, paramNames: string[]): TestCase[] {
  const cases: TestCase[] = [];

  const pushCase = (rawInput: string, rawOutput: string) => {
    const inputText = rawInput.trim();
    const outputText = rawOutput.trim();
    if (!outputText) return;
    const input: Record<string, unknown> = {};
    if (paramNames.length === 0) {
      input["arg"] = coerceValue(inputText);
    } else {
      const positions: Array<{ name: string; start: number; valueStart: number }> = [];
      for (const name of paramNames) {
        const re = new RegExp(`(^|[,\\s])${name}\\s*=\\s*`, "g");
        let m: RegExpExecArray | null;
        while ((m = re.exec(inputText)) !== null) {
          positions.push({
            name,
            start: m.index + (m[1] ? m[1].length : 0),
            valueStart: m.index + m[0].length,
          });
        }
      }
      positions.sort((a, b) => a.start - b.start);
      for (let i = 0; i < positions.length; i++) {
        const { name, valueStart } = positions[i];
        const end = i + 1 < positions.length ? positions[i + 1].start : inputText.length;
        let raw = inputText.slice(valueStart, end).trim();
        raw = raw.replace(/,\s*$/, "").trim();
        input[name] = coerceValue(raw);
      }
    }
    cases.push({ input, expected: coerceValue(outputText) });
  };

  // Format A: fenced code blocks with `Input: ... Output: ...` inside.
  const fenceRe = /```[a-zA-Z0-9]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fenceRe.exec(md)) !== null) {
    const block = match[1] ?? "";
    const inputMatch = block.match(/Input:\s*([\s\S]*?)(?:\n\s*Output:|$)/);
    const outputMatch = block.match(/Output:\s*([\s\S]*?)(?:\n\s*Explanation:|\n\s*$|$)/);
    if (inputMatch && outputMatch) pushCase(inputMatch[1], outputMatch[1]);
  }
  if (cases.length > 0) return cases;

  // Format B: inline `**Input:** ... **Output:** ...` paragraphs. Strip bold
  // markers first so the regex stays simple.
  const flat = md.replace(/\*\*/g, "");
  const inlineRe =
    /Input:\s*([\s\S]*?)\n\s*Output:\s*([\s\S]*?)(?=\n\s*(?:Explanation:|Example\b|Constraints\b|Follow ?up\b|Note:|$))/g;
  while ((match = inlineRe.exec(flat)) !== null) {
    pushCase(match[1], match[2]);
  }

  return cases;
}

/**
 * Rewrite a LeetCode python3 starter snippet into a useful Python stub.
 *
 * Two modes:
 *
 * - Standard problems (have a `class Solution:` line): emit
 *   `class Solution:\n    <def>\n        pass\n`. We pick the first
 *   `def <name>(self, ...)` *after* `class Solution:` whose name is not
 *   `__init__`, which skips LeetCode's commented `ListNode`/`TreeNode`
 *   helper-class definitions that come before it.
 *
 * - Design problems (no `class Solution:`, just the user's class — `LRUCache`,
 *   `MinStack`, etc.): preserve the original class skeleton (sans trailing
 *   "Your X object will be..." usage comments) so the user can fill in each
 *   method. Method name is the first `def` we find (typically `__init__`).
 *
 * Throws if no class with a recognisable `def <name>(self, ...)` exists.
 */
export function deriveStarter(pythonSnippet: string): { starter: string; methodName: string } {
  const lines = pythonSnippet.split("\n");
  const defRe = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*self[^)]*\)/;

  const solutionIdx = lines.findIndex((l) => /^class\s+Solution\s*:/.test(l));
  if (solutionIdx >= 0) {
    for (let i = solutionIdx + 1; i < lines.length; i++) {
      const m = lines[i].match(defRe);
      if (!m) continue;
      if (m[1] === "__init__") continue;
      const starter = `class Solution:\n${lines[i]}\n        pass\n`;
      return { starter, methodName: m[1] };
    }
    throw new Error(
      "deriveStarter: found `class Solution:` but no usable method (only __init__?)",
    );
  }

  const classIdx = lines.findIndex((l) => /^class\s+[A-Za-z_]\w*\s*:/.test(l));
  if (classIdx < 0) {
    throw new Error("deriveStarter: no class definition found in snippet");
  }
  let methodName: string | null = null;
  for (let i = classIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(defRe);
    if (m) {
      methodName = m[1];
      break;
    }
  }
  if (!methodName) {
    throw new Error("deriveStarter: class found but no `def <name>(self, ...)` inside");
  }
  // Drop trailing "Your X object will be ..." usage block; keep the class body.
  const body = lines
    .slice(classIdx)
    .filter((l) => !/^\s*#\s*(Your|Example|param_)/.test(l))
    .join("\n")
    .replace(/\n+$/, "");
  return { starter: body + "\n", methodName };
}

type LCParam = { name: string; type?: string };
// Standard problems carry { name, params }; design problems carry
// { classname, methods, ... } and have no top-level params.
type LCMeta = { name?: string; params?: LCParam[]; classname?: string };
type LCFetchResult = { content: string; metaData: LCMeta; python3: string };

const LC_QUERY = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    title
    content
    metaData
    codeSnippets { lang langSlug code }
    exampleTestcases
  }
}`;

/**
 * Fetch a problem's content + python3 starter from the public LeetCode GraphQL
 * endpoint. Throws on non-200 or missing data.
 */
export async function fetchLC(slug: string): Promise<LCFetchResult> {
  const res = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "lcneet-importer/1.0",
      referer: `https://leetcode.com/problems/${slug}/`,
    },
    body: JSON.stringify({
      query: LC_QUERY,
      variables: { titleSlug: slug },
      operationName: "questionData",
    }),
  });
  if (!res.ok) throw new Error(`fetchLC(${slug}): HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      question?: {
        content: string | null;
        metaData: string | null;
        codeSnippets: Array<{ lang: string; langSlug: string; code: string }> | null;
      } | null;
    };
  };
  const q = json.data?.question;
  if (!q || !q.content || !q.metaData || !q.codeSnippets) {
    throw new Error(`fetchLC(${slug}): missing question data`);
  }
  const py = q.codeSnippets.find((s) => s.langSlug === "python3");
  if (!py) throw new Error(`fetchLC(${slug}): no python3 snippet`);
  const metaData = JSON.parse(q.metaData) as LCMeta;
  return { content: q.content, metaData, python3: py.code };
}

type IndexRow = {
  id: number;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  neetcode_video_url: string | null;
};

function parseRefetchArg(argv: string[]): { all: boolean; slugs: Set<string> } {
  const arg = argv.find((a) => a.startsWith("--refetch="));
  if (!arg) return { all: false, slugs: new Set() };
  const value = arg.slice("--refetch=".length);
  if (value === "ALL") return { all: true, slugs: new Set() };
  return { all: false, slugs: new Set(value.split(",").map((s) => s.trim()).filter(Boolean)) };
}

export async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const indexPath = resolve(here, "neetcode-150-index.json");
  const outPath = resolve(here, "..", "lib", "problems", "neetcode150.json");

  const index = JSON.parse(readFileSync(indexPath, "utf8")) as IndexRow[];
  if (index.length !== 150) {
    throw new Error(`expected 150 rows in index, got ${index.length}`);
  }

  const existing = new Map<string, Problem>();
  if (existsSync(outPath)) {
    const raw = JSON.parse(readFileSync(outPath, "utf8")) as unknown;
    const parsed = Problems.parse(raw);
    for (const p of parsed) existing.set(p.slug, p);
  }

  const { all, slugs } = parseRefetchArg(process.argv);
  const failures: Array<{ slug: string; reason: string }> = [];
  const out: Problem[] = [];

  for (const row of index) {
    const cached = existing.get(row.slug);
    const shouldFetch = all || slugs.has(row.slug) || !cached;

    if (!shouldFetch && cached) {
      // Overlay metadata from index but preserve fetched fields.
      out.push({
        ...cached,
        id: row.id,
        title: row.title,
        difficulty: row.difficulty,
        topic: row.topic,
        neetcode_video_url: row.neetcode_video_url,
      });
      continue;
    }

    try {
      const r = await fetchLC(row.slug);
      const description_md = htmlToMarkdown(r.content);
      const { starter, methodName } = deriveStarter(r.python3);
      const paramNames = r.metaData.params?.map((p) => p.name) ?? [];
      if (paramNames.length === 0 && !r.metaData.classname) {
        failures.push({ slug: row.slug, reason: "no params in metaData" });
      }
      const cases = parseExamples(description_md, paramNames);
      let test_cases: TestCase[] = cases;
      if (cases.length === 0) {
        test_cases = [{ input: {}, expected: null }];
        failures.push({ slug: row.slug, reason: "no test cases parsed" });
      }
      out.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        difficulty: row.difficulty,
        topic: row.topic,
        neetcode_video_url: row.neetcode_video_url,
        description_md,
        starter_code: starter,
        test_cases,
        editorial_md: null,
        method_name: methodName,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ slug: row.slug, reason });
      if (cached) {
        out.push({
          ...cached,
          id: row.id,
          title: row.title,
          difficulty: row.difficulty,
          topic: row.topic,
          neetcode_video_url: row.neetcode_video_url,
        });
      } else {
        // Emit a placeholder so the file always has all 150 rows.
        // Manual edit pass (Task 9) fills these in — typically LC Premium.
        out.push({
          id: row.id,
          slug: row.slug,
          title: row.title,
          difficulty: row.difficulty,
          topic: row.topic,
          neetcode_video_url: row.neetcode_video_url,
          description_md: `> _Description pending manual entry (importer error: ${reason})._`,
          starter_code: "class Solution:\n    def solve(self):\n        pass\n",
          test_cases: [{ input: {}, expected: null }],
          editorial_md: null,
          method_name: "solve",
        });
      }
    }

    await new Promise((r) => setTimeout(r, 350));
  }

  // Validate before writing — never write an invalid file.
  const validated = Problems.parse(out);
  writeFileSync(outPath, JSON.stringify(validated, null, 2) + "\n", "utf8");

  console.log(`wrote ${validated.length} problems to ${outPath}`);
  if (failures.length > 0) {
    console.log(`\n${failures.length} slug(s) need manual attention:`);
    for (const f of failures) console.log(`  - ${f.slug}: ${f.reason}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
