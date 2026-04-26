import type Database from "better-sqlite3";
import {
  PATTERN_GROUPS,
  getPatternName,
  topicToPatternId,
} from "@/lib/patterns/groups";

export type WeakPattern = {
  pattern: string;
  label: string;
  failRate: number;
  hint: string;
};

const HINTS: Record<string, string> = {
  arrays: "Reach for a hash map before nested loops.",
  twoptr: "Pin one pointer; advance both past duplicates.",
  sliding: "Track last-seen index; never reset the window.",
  stack: "Push indices, not values, when you need distance.",
  binsearch: "Boundary conditions on lo/hi.",
  linkedlist: "Sentinel head + slow/fast pointers.",
  trees: "Decide pre/in/post-order before you write code.",
  tries: "Children are an array of 26, not a hash map.",
  heap: "Reach for `heapq` before sorting twice.",
  backtrack: "Mutate then undo — never copy the path.",
  graphs: "BFS for shortest path, DFS for connectivity.",
  advgraphs: "Topological order or union-find — pick one.",
  dp1: "Define state in plain English first.",
  dp2: "Initialise the first row & column.",
  greedy: "Prove the swap argument before you commit.",
  intervals: "Sort by start; merge by max end.",
  math: "Watch for integer overflow on products.",
  bits: "XOR self-cancels — use it as a free toggle.",
};

type AttemptRow = { topic: string; status: string };

export function getWeakPatterns(
  db: Database.Database,
  userId: number,
): WeakPattern[] {
  const rows = db
    .prepare(
      `SELECT p.topic AS topic, a.status AS status
       FROM attempts a JOIN problems p ON p.id = a.problem_id
       WHERE a.user_id = ?`,
    )
    .all(userId) as AttemptRow[];

  const agg = new Map<string, { passed: number; failed: number }>();
  for (const r of rows) {
    const id = topicToPatternId(r.topic);
    const cur = agg.get(id) ?? { passed: 0, failed: 0 };
    if (r.status === "passed") cur.passed += 1;
    else cur.failed += 1;
    agg.set(id, cur);
  }

  const candidates: WeakPattern[] = [];
  for (const [id, c] of agg) {
    const total = c.passed + c.failed;
    if (total < 3) continue;
    const failRate = c.failed / total;
    if (failRate <= 0) continue;
    candidates.push({
      pattern: id,
      label: getPatternName(id),
      failRate,
      hint: HINTS[id] ?? "Review the canonical template.",
    });
  }
  candidates.sort((a, b) => b.failRate - a.failRate);
  if (candidates.length >= 3) return candidates.slice(0, 3);

  // Fallback: top patterns by unsolved/total ratio (most untouched first).
  const solvedByPattern = new Map<string, number>();
  const solvedRows = db
    .prepare(
      `SELECT DISTINCT p.id AS pid, p.topic AS topic
       FROM attempts a JOIN problems p ON p.id = a.problem_id
       WHERE a.user_id = ? AND a.status = 'passed'`,
    )
    .all(userId) as { pid: number; topic: string }[];
  for (const r of solvedRows) {
    const id = topicToPatternId(r.topic);
    solvedByPattern.set(id, (solvedByPattern.get(id) ?? 0) + 1);
  }

  const seen = new Set(candidates.map((c) => c.pattern));
  const ranked = [...PATTERN_GROUPS]
    .filter((g) => !seen.has(g.id))
    .map((g) => {
      const solved = solvedByPattern.get(g.id) ?? 0;
      const ratio = (g.total - solved) / Math.max(1, g.total);
      return { g, ratio };
    })
    .sort((a, b) => b.ratio - a.ratio);

  for (const { g } of ranked) {
    if (candidates.length >= 3) break;
    candidates.push({
      pattern: g.id,
      label: g.name,
      failRate: 0,
      hint: HINTS[g.id] ?? "Start with the canonical template.",
    });
  }
  return candidates.slice(0, 3);
}
