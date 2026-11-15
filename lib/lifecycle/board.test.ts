import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "libsql";
import { __resetDbCache, getDb } from "@/lib/db";
import { createUser } from "@/lib/auth/users";
import { seedProblems } from "@/lib/seed";
import { recordAttempt } from "@/lib/attempts/repo";
import { upsertReview } from "@/lib/sr/repo";
import { getBoard } from "./board";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

let db: Database.Database;
let userId: number;

const attempt = (problem_id: number, status: "passed" | "failed") =>
  recordAttempt(db, { user_id: userId, problem_id, code: "x", status, runtime_ms: 1, mode: "run" });
const review = (problem_id: number, dueInDays: number, interval_days: number) =>
  upsertReview(db, { user_id: userId, problem_id, due_at: NOW + dueInDays * DAY, ease: 2.5, interval_days });

beforeEach(async () => {
  __resetDbCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "board-"));
  db = getDb(path.join(dir, "test.db"));
  seedProblems(db);
  userId = (await createUser(db, "u@test", "x")).id;
});

afterEach(() => {
  __resetDbCache();
});

describe("getBoard", () => {
  test("places each problem in the column its history implies", () => {
    // 1 untouched
    attempt(2, "failed");
    attempt(3, "passed");
    review(3, 6, 6);
    attempt(4, "failed");
    review(4, 1, 1); // flagged, never solved
    attempt(5, "passed");
    // mastery needs accepted passes on three separate days
    for (const daysAgo of [9, 30])
      db.prepare(
        "INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode, created_at) VALUES (?, 5, 'x', 'passed', 1, 'run', strftime('%s','now') - ?)",
      ).run(userId, daysAgo * 86400);
    review(5, 30, 30);

    const board = getBoard(db, userId, NOW);
    expect(board.map((c) => c.id)).toEqual(["todo", "attempting", "revisit", "solved", "mastered"]);

    const stageOf = (id: number) =>
      board.find((c) => c.cards.some((card) => card.problemId === id))!.id;
    expect(stageOf(1)).toBe("todo");
    expect(stageOf(2)).toBe("attempting");
    expect(stageOf(3)).toBe("solved");
    expect(stageOf(4)).toBe("revisit");
    expect(stageOf(5)).toBe("mastered");

    const flagged = board[2].cards[0];
    expect(flagged).toMatchObject({ problemId: 4, stage: "revisit", dueAt: NOW + DAY });
    expect(flagged.slug).toBeTruthy();
    expect(flagged.patternName).toBeTruthy();
    // Every catalog problem appears exactly once.
    const total = board.reduce((n, c) => n + c.cards.length, 0);
    expect(total).toBe((db.prepare("SELECT COUNT(*) AS n FROM problems").get() as { n: number }).n);
  });

  test("a long interval is not mastery unless the passes fell on three separate days", () => {
    const col = (id: string) =>
      getBoard(db, userId, NOW).find((c) => c.id === id)!.cards.map((c) => c.problemId);
    const pass = db.prepare(
      "INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode, created_at) VALUES (?, ?, 'x', 'passed', 1, 'run', ?)",
    );
    const t = Math.floor(NOW / 1000);
    // problem 5: three accepted submits in one sitting, schedule already at 40 days
    for (const at of [t, t - 60, t - 120]) pass.run(userId, 5, at);
    upsertReview(db, { user_id: userId, problem_id: 5, due_at: NOW + 40 * DAY, ease: 2.5, interval_days: 40 });
    // problem 6: the same schedule, earned on three different days
    for (const at of [t, t - 7 * 86400, t - 20 * 86400]) pass.run(userId, 6, at);
    upsertReview(db, { user_id: userId, problem_id: 6, due_at: NOW + 40 * DAY, ease: 2.5, interval_days: 40 });
    expect(col("solved")).toContain(5);
    expect(col("mastered")).toEqual([6]);
  });

  test("returns all five columns even when the user has done nothing", () => {
    const board = getBoard(db, userId, NOW);
    expect(board).toHaveLength(5);
    expect(board.slice(1).every((c) => c.cards.length === 0)).toBe(true);
    expect(board[0].cards.map((c) => c.problemId).slice(0, 3)).toEqual([1, 2, 3]);
  });

  test("revisit column is sorted most-overdue first", () => {
    for (const id of [1, 2, 3]) attempt(id, "passed");
    review(1, 1, 1); // flagged, due tomorrow
    review(2, -1, 6); // a day overdue
    review(3, -5, 6); // five days overdue
    const revisit = getBoard(db, userId, NOW)[2];
    expect(revisit.cards.map((c) => c.problemId)).toEqual([3, 2, 1]);
  });
});
