import { describe, it, expect } from "vitest";
import data from "./neetcode150.json";
import { Problems } from "./types";
import { PATTERN_GROUPS, topicToPatternId } from "../patterns/groups";

const problems = Problems.parse(data);

// Slugs whose `test_cases` are intentionally placeholders. These need a richer
// runner harness than the simple `{input, expected}` shape:
// - LeetCode Premium problems (no public GraphQL access; descriptions pending).
// - Design problems (operations/args harness — separate runner; out of scope).
// - Graph problems whose input is a serialized adjacency-list-of-nodes.
const PLACEHOLDER_TEST_CASE_SLUGS = new Set([
  // Premium (no API access)
  "encode-and-decode-strings",
  "walls-and-gates",
  "number-of-connected-components-in-an-undirected-graph",
  "graph-valid-tree",
  "alien-dictionary",
  "meeting-rooms",
  "meeting-rooms-ii",
  // Design problems (class API)
  "min-stack",
  "time-based-key-value-store",
  "lru-cache",
  "implement-trie-prefix-tree",
  "design-add-and-search-words-data-structure",
  "design-twitter",
  "find-median-from-data-stream",
  "kth-largest-element-in-a-stream",
  "detect-squares",
  // Graph node serialization
  "clone-graph",
]);

describe("neetcode150.json", () => {
  it("has exactly 150 unique problems with sequential ids", () => {
    expect(problems).toHaveLength(150);
    expect(new Set(problems.map((p) => p.slug)).size).toBe(150);
    expect(new Set(problems.map((p) => p.id)).size).toBe(150);
    expect(problems.map((p) => p.id)).toEqual(
      Array.from({ length: 150 }, (_, i) => i + 1),
    );
  });

  it("every problem has a YouTube video URL", () => {
    for (const p of problems) {
      expect(p.neetcode_video_url, p.slug).toMatch(
        /^https:\/\/www\.youtube\.com\/watch\?v=/,
      );
    }
  });

  it("non-placeholder problems have at least one test case with non-empty input", () => {
    for (const p of problems) {
      expect(p.test_cases.length, p.slug).toBeGreaterThan(0);
      if (PLACEHOLDER_TEST_CASE_SLUGS.has(p.slug)) continue;
      const first = p.test_cases[0].input as Record<string, unknown>;
      expect(Object.keys(first).length, p.slug).toBeGreaterThan(0);
    }
  });

  it("every topic maps to a known pattern group with matching counts", () => {
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
