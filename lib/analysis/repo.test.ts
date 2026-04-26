import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import {
  upsertAnalysis,
  getByAttempt,
  recordMistake,
  listMistakesForUser,
  bumpPattern,
  listPatternCounters,
} from "./repo";

async function setup() {
  __resetDbCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "analysis-repo-"));
  const file = path.join(dir, "test.db");
  const db = getDb(file);
  seedProblems(db);
  const user = await createUser(db, "u@example.com", "pw");
  const info = db
    .prepare(
      `INSERT INTO attempts (user_id, problem_id, code, status) VALUES (?, ?, ?, ?)`,
    )
    .run(user.id, 1, "code", "passed");
  const attemptId = Number(info.lastInsertRowid);
  return { db, userId: user.id, attemptId };
}

describe("analysis/repo", () => {
  it("upsertAnalysis inserts a new row", async () => {
    const { db, attemptId } = await setup();
    upsertAnalysis(db, {
      attempt_id: attemptId,
      kind: "quality",
      content_md: "v1",
      status: "pending",
    });
    const rows = getByAttempt(db, attemptId);
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe("quality");
    expect(rows[0].content_md).toBe("v1");
    expect(rows[0].status).toBe("pending");
  });

  it("upsertAnalysis second call updates content + status", async () => {
    const { db, attemptId } = await setup();
    upsertAnalysis(db, {
      attempt_id: attemptId,
      kind: "quality",
      content_md: "v1",
      status: "pending",
    });
    upsertAnalysis(db, {
      attempt_id: attemptId,
      kind: "quality",
      content_md: "v2",
      status: "done",
    });
    const rows = getByAttempt(db, attemptId);
    expect(rows.length).toBe(1);
    expect(rows[0].content_md).toBe("v2");
    expect(rows[0].status).toBe("done");
  });

  it("getByAttempt returns rows in stable kind order", async () => {
    const { db, attemptId } = await setup();
    // Insert in arbitrary order
    upsertAnalysis(db, { attempt_id: attemptId, kind: "mistake", content_md: "m", status: "done" });
    upsertAnalysis(db, { attempt_id: attemptId, kind: "quality", content_md: "q", status: "done" });
    upsertAnalysis(db, { attempt_id: attemptId, kind: "pattern", content_md: "p", status: "done" });
    upsertAnalysis(db, { attempt_id: attemptId, kind: "comparison", content_md: "c", status: "done" });
    upsertAnalysis(db, { attempt_id: attemptId, kind: "complexity", content_md: "x", status: "done" });
    const rows = getByAttempt(db, attemptId);
    expect(rows.map((r) => r.kind)).toEqual([
      "quality",
      "complexity",
      "comparison",
      "pattern",
      "mistake",
    ]);
  });

  it("recordMistake inserts and listMistakesForUser returns it", async () => {
    const { db, userId, attemptId } = await setup();
    const id = recordMistake(db, {
      user_id: userId,
      problem_id: 1,
      attempt_id: attemptId,
      category: "off-by-one",
      note: "missed boundary",
    });
    expect(id).toBeGreaterThan(0);
    const rows = listMistakesForUser(db, userId);
    expect(rows.length).toBe(1);
    expect(rows[0].category).toBe("off-by-one");
    expect(rows[0].note).toBe("missed boundary");
    expect(rows[0].problem_id).toBe(1);
  });

  it("bumpPattern increments; second call increments again", async () => {
    const { db, userId } = await setup();
    bumpPattern(db, userId, "sliding-window");
    bumpPattern(db, userId, "sliding-window");
    const rows = listPatternCounters(db, userId);
    expect(rows.length).toBe(1);
    expect(rows[0].pattern).toBe("sliding-window");
    expect(rows[0].solved_count).toBe(2);
  });

  it("listPatternCounters returns rows ordered by solved_count DESC", async () => {
    const { db, userId } = await setup();
    bumpPattern(db, userId, "two-pointers");
    bumpPattern(db, userId, "sliding-window");
    bumpPattern(db, userId, "sliding-window");
    bumpPattern(db, userId, "sliding-window");
    bumpPattern(db, userId, "bfs");
    bumpPattern(db, userId, "bfs");
    const rows = listPatternCounters(db, userId);
    expect(rows.map((r) => r.pattern)).toEqual(["sliding-window", "bfs", "two-pointers"]);
    expect(rows.map((r) => r.solved_count)).toEqual([3, 2, 1]);
  });
});
