/**
 * One-off: repair test_cases in lib/problems/neetcode150.json that were
 * captured before coerceValue() handled LeetCode's `\[`/`\]` markdown
 * escapes. For each test case input value and expected, if it's a string
 * carrying those escapes (or an unparsed quoted JSON literal), re-run the
 * fixed coerceValue on it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { coerceValue } from "./import-neetcode-150";
import { Problems } from "../lib/problems/types";

function recoerce(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (!/\\\[|\\\]/.test(value) && !/^".*"$/.test(value.trim())) return value;
  return coerceValue(value);
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, "..", "lib", "problems", "neetcode150.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const problems = Problems.parse(raw);

  let fixed = 0;
  for (const p of problems) {
    for (const tc of p.test_cases) {
      const inputObj = (tc.input ?? {}) as Record<string, unknown>;
      const newInput: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(inputObj)) {
        const next = recoerce(v);
        if (next !== v) fixed++;
        newInput[k] = next;
      }
      tc.input = newInput;
      const nextExpected = recoerce(tc.expected);
      if (nextExpected !== tc.expected) fixed++;
      tc.expected = nextExpected;
    }
  }

  const validated = Problems.parse(problems);
  writeFileSync(path, JSON.stringify(validated, null, 2) + "\n", "utf8");
  console.log(`fixed ${fixed} test case value(s)`);
}

main();
