import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import { bumpPattern, recordMistake } from "../analysis/repo";
import {
  solvedByTopic,
  solvedByDifficulty,
  recentMistakes,
  patternMastery,
} from "./aggregate";

async function setup() {
  __resetDbCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-aggregate-"));
  const file = path.join(dir, "test.db");
  const db = getDb(file);
  seedProblems(db);
  const user = await createUser(db, "u@example.com", "pw");
  return { db, userId: user.id };
}

function recordPassedAttempt(
  db: ReturnType<typeof getDb>,
  userId: number,
  problemId: number,
): number {
  const info = db
    .prepare(
      `INSERT INTO attempts (user_id, problem_id, code, status) VALUES (?, ?, ?, ?)`,
    )
    .run(userId, problemId, "code", "passed");
  return Number(info.lastInsertRowid);
}

describe("stats/aggregate", () => {
  it("solvedByTopic returns rows with solved:0 when no attempts", async () => {
    const { db, userId } = await setup();
    const rows = solvedByTopic(db, userId);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.solved).toBe(0);
      expect(r.total).toBeGreaterThan(0);
    }
  });

  it("solvedByTopic shows solved:1 after a passed attempt on problem 1", async () => {
    const { db, userId } = await setup();
    const problem1Topic = (db
      .prepare(`SELECT topic FROM problems WHERE id = 1`)
      .get() as { topic: string }).topic;
    recordPassedAttempt(db, userId, 1);
    const rows = solvedByTopic(db, userId);
    const slice = rows.find((r) => r.topic === problem1Topic);
    expect(slice).toBeDefined();
    expect(slice!.solved).toBe(1);
  });

  it("solvedByDifficulty is ordered Easy → Medium → Hard", async () => {
    const { db, userId } = await setup();
    const rows = solvedByDifficulty(db, userId);
    const order: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };
    const indices = rows.map((r) => order[r.difficulty] ?? 99);
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it("recentMistakes returns inserted mistakes", async () => {
    const { db, userId } = await setup();
    const attemptId = recordPassedAttempt(db, userId, 1);
    recordMistake(db, {
      user_id: userId,
      problem_id: 1,
      attempt_id: attemptId,
      category: "off-by-one",
      note: "missed boundary",
    });
    const rows = recentMistakes(db, userId);
    expect(rows.length).toBe(1);
    expect(rows[0].category).toBe("off-by-one");
  });

  it("patternMastery returns bumped patterns DESC by count", async () => {
    const { db, userId } = await setup();
    bumpPattern(db, userId, "two-pointers");
    bumpPattern(db, userId, "sliding-window");
    bumpPattern(db, userId, "sliding-window");
    bumpPattern(db, userId, "sliding-window");
    bumpPattern(db, userId, "bfs");
    bumpPattern(db, userId, "bfs");
    const rows = patternMastery(db, userId);
    expect(rows.map((r) => r.pattern)).toEqual([
      "sliding-window",
      "bfs",
      "two-pointers",
    ]);
    expect(rows.map((r) => r.solved_count)).toEqual([3, 2, 1]);
  });
});
