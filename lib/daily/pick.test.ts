import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import { upsertReview } from "../sr/repo";
import { recordAttempt } from "../attempts/repo";
import { pickDaily } from "./pick";

async function setup() {
  __resetDbCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "daily-pick-"));
  const file = path.join(dir, "test.db");
  const db = getDb(file);
  seedProblems(db);
  const user = await createUser(db, "u@example.com", "pw");
  return { db, userId: user.id };
}

describe("daily/pick", () => {
  it("returns the same problemId for the same (userId, date) on repeated calls", async () => {
    const { db, userId } = await setup();
    const date = "2026-04-26";
    const now = 1_700_000_000;
    const a = pickDaily(db, userId, date, now);
    const b = pickDaily(db, userId, date, now);
    const c = pickDaily(db, userId, date, now);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("prefers due reviews when present", async () => {
    const { db, userId } = await setup();
    const now = 1_700_000_000;
    upsertReview(db, {
      user_id: userId,
      problem_id: 2,
      due_at: now - 100,
      ease: 2.5,
      interval_days: 1,
    });
    const id = pickDaily(db, userId, "2026-04-26", now);
    expect(id).toBe(2);
  });

  it("falls back to unsolved when no due reviews", async () => {
    const { db, userId } = await setup();
    const now = 1_700_000_000;
    // mark problem 1 as solved
    recordAttempt(db, {
      user_id: userId,
      problem_id: 1,
      code: "x",
      status: "passed",
      runtime_ms: 1,
      mode: "run",
    });
    const id = pickDaily(db, userId, "2026-04-26", now);
    expect(id).not.toBe(1);
  });

  it("falls back to any problem when all are solved AND no reviews", async () => {
    const { db, userId } = await setup();
    const now = 1_700_000_000;
    const all = db.prepare(`SELECT id FROM problems`).all() as { id: number }[];
    expect(all.length).toBeGreaterThan(0);
    for (const r of all) {
      recordAttempt(db, {
        user_id: userId,
        problem_id: r.id,
        code: "x",
        status: "passed",
        runtime_ms: 1,
        mode: "run",
      });
    }
    const id1 = pickDaily(db, userId, "2026-04-26", now);
    const id2 = pickDaily(db, userId, "2026-04-26", now);
    expect(id1).toBe(id2);
    expect(all.map((r) => r.id)).toContain(id1);
  });
});
