import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";

function run(code: string, cases: unknown, method: string) {
  const py = `import json,sys
sys.path.insert(0,"lib/pyodide")
import harness
print(harness.run_tests(sys.argv[1],sys.argv[2],sys.argv[3]))`;
  const out = execFileSync("python3", ["-c", py, code, JSON.stringify(cases), method]);
  return JSON.parse(out.toString()).results.map((r: { passed: boolean }) => r.passed);
}

test("any-order problems ignore order inside groups too", () => {
  const code = `class Solution:
    def groupAnagrams(self, strs):
        seen = {}
        for s in strs:
            seen.setdefault("".join(sorted(s)), []).append(s)
        return list(seen.values())`;
  const cases = [
    {
      input: { strs: ["eat", "tea", "tan", "ate", "nat", "bat"] },
      expected: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]],
    },
    { input: { strs: ["ab", "ba", "c"] }, expected: [["ab"], ["ba", "c"]] },
  ];
  expect(run(code, cases, "groupAnagrams")).toEqual([true, false]);
});

test("inner order still matters for other problems", () => {
  const code = `class Solution:
    def permute(self, nums):
        return [[1, 2], [1, 2]]`;
  const cases = [{ input: { nums: [1, 2] }, expected: [[1, 2], [2, 1]] }];
  expect(run(code, cases, "permute")).toEqual([false]);
});
