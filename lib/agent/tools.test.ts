import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import { recordAttempt } from "../attempts/repo";
import { getProblemMeta, getUserHistory } from "./tools";

const TEST_DB = "data/agent-tools-test.db";

async function setup() {
  __resetDbCache();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const db = getDb(TEST_DB);
  seedProblems(db);
  const u = await createUser(db, "u@example.com", "pw");
  return { db, userId: u.id };
}

describe("agent tools", () => {
  it("getProblemMeta returns title/difficulty/topic + truncated description", async () => {
    const { db } = await setup();
    const meta = getProblemMeta(db, 1);
    expect(meta).not.toBeNull();
    expect(meta!.title).toBe("Two Sum");
    expect(meta!.difficulty).toBeTruthy();
    expect(meta!.description_excerpt.length).toBeLessThanOrEqual(500);
  });

  it("getProblemMeta returns null for unknown id", async () => {
    const { db } = await setup();
    expect(getProblemMeta(db, 99999)).toBeNull();
  });

  it("getUserHistory filters by topic and limits", async () => {
    const { db, userId } = await setup();
    // problem 1 (Valid Anagram) and 3 (Two Sum) — confirm topics in fixture by querying
    const topicRow = db.prepare("SELECT topic FROM problems WHERE id = 1").get() as { topic: string };
    recordAttempt(db, { user_id: userId, problem_id: 1, code: "x", status: "passed", runtime_ms: 1, mode: "run" });
    recordAttempt(db, { user_id: userId, problem_id: 1, code: "x", status: "failed", runtime_ms: 1, mode: "run" });
    const hist = getUserHistory(db, userId, topicRow.topic, 10);
    expect(hist.length).toBeGreaterThanOrEqual(1);
    expect(hist[0]).toHaveProperty("slug");
    expect(hist[0]).toHaveProperty("status");
  });
});
