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
