// Canonical NeetCode 150 pattern groups. Mirrors design source
// (/tmp/design-extract/lc-neet/project/data.jsx PATTERNS).

export type PatternGroup = {
  id: string;
  name: string;
  total: number;
};

export const PATTERN_GROUPS: readonly PatternGroup[] = [
  { id: "arrays", name: "Arrays & Hashing", total: 9 },
  { id: "twoptr", name: "Two Pointers", total: 5 },
  { id: "sliding", name: "Sliding Window", total: 6 },
  { id: "stack", name: "Stack", total: 7 },
  { id: "binsearch", name: "Binary Search", total: 7 },
  { id: "linkedlist", name: "Linked List", total: 11 },
  { id: "trees", name: "Trees", total: 15 },
  { id: "tries", name: "Tries", total: 3 },
  { id: "heap", name: "Heap / Priority Q", total: 7 },
  { id: "backtrack", name: "Backtracking", total: 9 },
  { id: "graphs", name: "Graphs", total: 13 },
  { id: "advgraphs", name: "Advanced Graphs", total: 6 },
  { id: "dp1", name: "1-D DP", total: 12 },
  { id: "dp2", name: "2-D DP", total: 11 },
  { id: "greedy", name: "Greedy", total: 8 },
  { id: "intervals", name: "Intervals", total: 6 },
  { id: "math", name: "Math & Geometry", total: 8 },
  { id: "bits", name: "Bit Manipulation", total: 7 },
] as const;

const TOPIC_TO_PATTERN: Record<string, string> = {
  "arrays & hashing": "arrays",
  "arrays and hashing": "arrays",
  arrays: "arrays",
  hashing: "arrays",
  "two pointers": "twoptr",
  "sliding window": "sliding",
  stack: "stack",
  "binary search": "binsearch",
  "linked list": "linkedlist",
  trees: "trees",
  tree: "trees",
  tries: "tries",
  trie: "tries",
  heap: "heap",
  "heap / priority q": "heap",
  "heap / priority queue": "heap",
  "priority queue": "heap",
  backtracking: "backtrack",
  graphs: "graphs",
  graph: "graphs",
  "advanced graphs": "advgraphs",
  "1-d dp": "dp1",
  "1d dp": "dp1",
  "dynamic programming": "dp1",
  dp: "dp1",
  "2-d dp": "dp2",
  "2d dp": "dp2",
  greedy: "greedy",
  intervals: "intervals",
  "math & geometry": "math",
  math: "math",
  geometry: "math",
  "bit manipulation": "bits",
  bits: "bits",
};

export function topicToPatternId(topic: string | null | undefined): string {
  if (!topic) return "arrays";
  const k = topic.trim().toLowerCase();
  return TOPIC_TO_PATTERN[k] ?? "arrays";
}

export function getPatternName(id: string): string {
  return PATTERN_GROUPS.find((g) => g.id === id)?.name ?? id;
}
