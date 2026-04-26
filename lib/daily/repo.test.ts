import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import { getOrCreateDaily, markDailyComplete, getDaily } from "./repo";

async function setup() {
  __resetDbCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "daily-repo-"));
  const file = path.join(dir, "test.db");
  const db = getDb(file);
  seedProblems(db);
  const user = await createUser(db, "u@example.com", "pw");
  return { db, userId: user.id };
}

describe("daily/repo", () => {
  it("getOrCreateDaily calls pickFn only on first call", async () => {
    const { db, userId } = await setup();
    const pick = vi.fn(() => 2);
    const row = getOrCreateDaily(db, userId, "2026-04-26", pick);
    expect(pick).toHaveBeenCalledTimes(1);
    expect(row.problem_id).toBe(2);
    expect(row.completed).toBe(0);
  });

  it("second call same day returns existing row without calling pickFn", async () => {
    const { db, userId } = await setup();
    const pick = vi.fn(() => 2);
    getOrCreateDaily(db, userId, "2026-04-26", pick);
    const pick2 = vi.fn(() => 9);
    const row2 = getOrCreateDaily(db, userId, "2026-04-26", pick2);
    expect(pick2).not.toHaveBeenCalled();
    expect(row2.problem_id).toBe(2);
  });

  it("markDailyComplete flips completed=1", async () => {
    const { db, userId } = await setup();
    getOrCreateDaily(db, userId, "2026-04-26", () => 1);
    markDailyComplete(db, userId, "2026-04-26");
    const row = getDaily(db, userId, "2026-04-26");
    expect(row!.completed).toBe(1);
  });
});
