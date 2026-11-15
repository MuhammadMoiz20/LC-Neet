/**
 * Runs every analysis section once against the real model, the same way
 * production does, and prints how each one went. Use it before changing the
 * model or its reasoning settings: `npm run check:llm`.
 *
 * Needs OPENROUTER_API_KEY in the shell or .env.local. Exits 1 if any section
 * fails or takes longer than SLOW_MS.
 */
import fs from "node:fs";
import { runOne } from "../lib/analysis/run-one";
import type { AnalysisKind } from "../lib/analysis/repo";

const SLOW_MS = 20_000;
const KINDS: AnalysisKind[] = ["grade", "quality", "complexity", "comparison", "pattern", "mistake"];

// .env.local without a dependency: KEY=value lines, existing shell vars win.
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is not set (shell or .env.local).");
  process.exit(1);
}

// The submission that stalled in production (attempt 188).
const input = {
  problemTitle: "Longest Repeating Character Replacement",
  problemTopic: "Sliding Window",
  problemDifficulty: "Medium",
  problemDescription:
    "You are given a string s and an integer k. You can choose any character of the string and change it to any other uppercase English character. You can perform this operation at most k times. Return the length of the longest substring containing the same letter you can get after performing the above operations.",
  code: `class Solution:
    def characterReplacement(self, s: str, k: int) -> int:
        count = {}
        l,r = 0,0
        res = 0
        most_common = 0
        for r in range(len(s)):
            count[s[r]] = count.get(s[r], 0) + 1
            most_common = max(most_common, count[s[r]])
            while (r - l + 1) - most_common > k:
                count[s[l]] -= 1
                l += 1
            res = max(res, r - l + 1)
        return res
`,
};

// Pull the token counts out of the client's per-call log line.
const usage: { reasoning?: number; out?: number }[] = [];
const log = console.log;
console.log = (...args: unknown[]) => {
  try {
    const j = JSON.parse(String(args[0]));
    if (j.evt === "llm") {
      usage.push({ out: j.usage?.completion_tokens, reasoning: j.usage?.completion_tokens_details?.reasoning_tokens });
      return;
    }
    if (j.evt === "llm_timeout") return log(`  (${j.kind}: try ${j.attempt} timed out, retrying)`);
  } catch {}
  log(...args);
};

async function main(): Promise<boolean> {
  const model = process.env.OPENROUTER_MODEL ?? "(default)";
  log(`model ${model}, analysis reasoning ${process.env.OPENROUTER_ANALYSIS_REASONING_EFFORT ?? "none"}\n`);
  const started = Date.now();
  const results = await Promise.all(
    KINDS.map(async (kind) => {
      const t = Date.now();
      const r = await runOne({ kind, ...input });
      const ms = Date.now() - t;
      const u = usage.shift() ?? {};
      return { kind, ms, status: r.status, first: r.content_md.split("\n")[0].slice(0, 70), ...u };
    }),
  );
  console.log = log;

  for (const r of results) {
    const flag = r.status !== "done" ? "FAIL" : r.ms > SLOW_MS ? "SLOW" : "ok";
    log(
      `${flag.padEnd(4)} ${r.kind.padEnd(10)} ${String(r.ms).padStart(6)}ms  out ${String(r.out ?? "-").padStart(5)} (reasoning ${r.reasoning ?? 0})  ${r.first}`,
    );
  }
  log(`\nall six in ${Date.now() - started}ms (they run in parallel, like production)`);
  return results.every((r) => r.status === "done" && r.ms <= SLOW_MS);
}

main().then((ok) => process.exit(ok ? 0 : 1));
