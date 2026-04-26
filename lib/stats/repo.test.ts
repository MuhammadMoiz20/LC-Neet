import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import { recordAttempt } from "../attempts/repo";
import {
  getSolvedProblemIds,
  getRecentAttempts,
  getDayStreak,
} from "./repo";

const TEST_DB = "data/stats-test.db";

async function setup() {
  __resetDbCache();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const db = getDb(TEST_DB);
  seedProblems(db);
  const user = await createUser(db, "u@example.com", "pw");
  return { db, userId: user.id };
}

describe("stats/repo", () => {
  it("getSolvedProblemIds returns distinct problem ids with at least one passed attempt", async () => {
    const { db, userId } = await setup();
    recordAttempt(db, { user_id: userId, problem_id: 1, code: "x", status: "failed", runtime_ms: 1, mode: "run" });
    recordAttempt(db, { user_id: userId, problem_id: 1, code: "x", status: "passed", runtime_ms: 1, mode: "run" });
    recordAttempt(db, { user_id: userId, problem_id: 2, code: "x", status: "passed", runtime_ms: 1, mode: "run" });
    recordAttempt(db, { user_id: userId, problem_id: 3, code: "x", status: "failed", runtime_ms: 1, mode: "run" });
    const solved = getSolvedProblemIds(db, userId);
    expect([...solved].sort()).toEqual([1, 2]);
  });

  it("getRecentAttempts returns latest N joined with problem title", async () => {
    const { db, userId } = await setup();
    recordAttempt(db, { user_id: userId, problem_id: 1, code: "a", status: "failed", runtime_ms: 1, mode: "run" });
    recordAttempt(db, { user_id: userId, problem_id: 2, code: "b", status: "passed", runtime_ms: 1, mode: "run" });
    const recent = getRecentAttempts(db, userId, 5);
    expect(recent.length).toBe(2);
    expect(recent[0].problem_title).toBe("Valid Anagram");
    expect(recent[0].status).toBe("passed");
  });

  it("getDayStreak counts consecutive days ending today with at least one attempt", async () => {
    const { db, userId } = await setup();
    const today = Math.floor(Date.now() / 1000);
    const day = 24 * 60 * 60;
    db.prepare(
      "INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode, created_at) VALUES (?, 1, 'x', 'passed', 1, 'run', ?)",
    ).run(userId, today);
    db.prepare(
      "INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode, created_at) VALUES (?, 1, 'x', 'passed', 1, 'run', ?)",
    ).run(userId, today - day);
    db.prepare(
      "INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode, created_at) VALUES (?, 1, 'x', 'passed', 1, 'run', ?)",
    ).run(userId, today - 3 * day);
    expect(getDayStreak(db, userId)).toBe(2);
  });

  it("getDayStreak returns 0 when no attempts today or yesterday", async () => {
    const { db, userId } = await setup();
    const old = Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60;
    db.prepare(
      "INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode, created_at) VALUES (?, 1, 'x', 'passed', 1, 'run', ?)",
    ).run(userId, old);
    expect(getDayStreak(db, userId)).toBe(0);
  });
});
