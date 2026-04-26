import { describe, it, expect } from "vitest";
import { looksLikeFullSolution } from "./filter";

describe("looksLikeFullSolution", () => {
  it("flags class Solution with a substantive method body", () => {
    const text = `Here you go:
\`\`\`python
class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
\`\`\``;
    expect(looksLikeFullSolution(text)).toBe(true);
  });

  it("flags top-level def with substantive body", () => {
    const text = `\`\`\`python
def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
\`\`\``;
    expect(looksLikeFullSolution(text)).toBe(true);
  });

  it("does NOT flag short pseudocode (≤3 non-trivial lines)", () => {
    const text = `Try this shape:
\`\`\`
for n in nums:
    track seen
    return when complement found
\`\`\``;
    expect(looksLikeFullSolution(text)).toBe(false);
  });

  it("does NOT flag a stub with only pass / docstring", () => {
    const text = `\`\`\`python
class Solution:
    def twoSum(self, nums, target):
        """Return indices."""
        pass
\`\`\``;
    expect(looksLikeFullSolution(text)).toBe(false);
  });

  it("does NOT flag prose discussion of class Solution", () => {
    expect(
      looksLikeFullSolution(
        "You'll define a class Solution with a method twoSum that takes nums and target.",
      ),
    ).toBe(false);
  });

  it("flags partial class Solution body that is already past 3 lines", () => {
    const text = `\`\`\`python
class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            x = target - n
            if x in seen:
\`\`\``;
    expect(looksLikeFullSolution(text)).toBe(true);
  });
});
