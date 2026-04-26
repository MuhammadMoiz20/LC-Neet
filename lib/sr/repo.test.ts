import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import { upsertReview, dueReviews, getReviewState } from "./repo";

async function setup() {
  __resetDbCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sr-repo-"));
  const file = path.join(dir, "test.db");
  const db = getDb(file);
  seedProblems(db);
  const user = await createUser(db, "u@example.com", "pw");
  return { db, userId: user.id };
}

describe("sr/repo", () => {
  it("upsertReview inserts a new row", async () => {
    const { db, userId } = await setup();
    upsertReview(db, {
      user_id: userId,
      problem_id: 1,
      due_at: 1000,
      ease: 2.5,
      interval_days: 1,
    });
    const state = getReviewState(db, userId, 1);
    expect(state).not.toBeNull();
    expect(state!.due_at).toBe(1000);
    expect(state!.ease).toBe(2.5);
    expect(state!.interval_days).toBe(1);
  });

  it("upsertReview second call with same (user_id, problem_id) updates", async () => {
    const { db, userId } = await setup();
    upsertReview(db, {
      user_id: userId,
      problem_id: 1,
      due_at: 1000,
      ease: 2.5,
      interval_days: 1,
    });
    upsertReview(db, {
      user_id: userId,
      problem_id: 1,
      due_at: 5000,
      ease: 2.6,
      interval_days: 4,
    });
    const state = getReviewState(db, userId, 1);
    expect(state!.due_at).toBe(5000);
    expect(state!.ease).toBe(2.6);
    expect(state!.interval_days).toBe(4);
  });

  it("dueReviews returns rows with due_at <= now, ordered ASC, limited", async () => {
    const { db, userId } = await setup();
    upsertReview(db, { user_id: userId, problem_id: 1, due_at: 100, ease: 2.5, interval_days: 1 });
    upsertReview(db, { user_id: userId, problem_id: 2, due_at: 50, ease: 2.5, interval_days: 1 });
    upsertReview(db, { user_id: userId, problem_id: 3, due_at: 9999, ease: 2.5, interval_days: 1 });
    const rows = dueReviews(db, userId, 300, 10);
    expect(rows.map((r) => r.problem_id)).toEqual([2, 1]);
    const limited = dueReviews(db, userId, 300, 1);
    expect(limited.map((r) => r.problem_id)).toEqual([2]);
  });

  it("getReviewState returns null when absent", async () => {
    const { db, userId } = await setup();
    expect(getReviewState(db, userId, 1)).toBeNull();
  });
});
