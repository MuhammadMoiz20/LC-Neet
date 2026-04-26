import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testState = { dbPath: "" };

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    getDb: (p?: string) => actual.getDb(p ?? testState.dbPath),
  };
});

import { __resetDbCache, getDb } from "@/lib/db";
import { createUser } from "@/lib/auth/users";
import { seedProblems } from "@/lib/seed";
import { getReviewState } from "@/lib/sr/repo";
import { auth } from "@/auth";

let userId: number;

beforeEach(async () => {
  __resetDbCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "actions-"));
  testState.dbPath = path.join(dir, "test.db");
  const db = getDb();
  seedProblems(db);
  const u = await createUser(db, "u@test", "x");
  userId = u.id;
  vi.mocked(auth).mockResolvedValue({ user: { id: String(userId) } } as never);
});

afterEach(() => {
  __resetDbCache();
});

describe("submitAttempt SR enqueue", () => {
  test("accepted submission enqueues SR review with future due_at", async () => {
    const { submitAttempt } = await import("./actions");
    const before = Date.now();
    await submitAttempt({
      problemId: 1,
      code: "ok",
      status: "passed",
      runtimeMs: 10,
      mode: "run",
    });
    const state = getReviewState(getDb(), userId, 1);
    expect(state).not.toBeNull();
    expect(state!.due_at).toBeGreaterThan(before);
    expect(state!.ease).toBeGreaterThanOrEqual(1.3);
  });

  test("failed submission does NOT enqueue review", async () => {
    const { submitAttempt } = await import("./actions");
    await submitAttempt({
      problemId: 1,
      code: "bad",
      status: "failed",
      runtimeMs: 5,
      mode: "run",
    });
    expect(getReviewState(getDb(), userId, 1)).toBeNull();
  });

  test("accepted submission marks today's daily complete when problems match", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const db = getDb();
    db.prepare(`INSERT INTO daily (user_id, date, problem_id) VALUES (?, ?, ?)`)
      .run(userId, today, 1);
    const { submitAttempt } = await import("./actions");
    await submitAttempt({ problemId: 1, code: "ok", status: "passed", runtimeMs: 1, mode: "run" });
    const row = db.prepare(`SELECT completed FROM daily WHERE user_id = ? AND date = ?`)
      .get(userId, today) as { completed: number };
    expect(row.completed).toBe(1);
  });

  test("daily not flipped when accepted problem differs from today's daily", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const db = getDb();
    db.prepare(`INSERT INTO daily (user_id, date, problem_id) VALUES (?, ?, ?)`)
      .run(userId, today, 2);
    const { submitAttempt } = await import("./actions");
    await submitAttempt({ problemId: 1, code: "ok", status: "passed", runtimeMs: 1, mode: "run" });
    const row = db.prepare(`SELECT completed FROM daily WHERE user_id = ? AND date = ?`)
      .get(userId, today) as { completed: number };
    expect(row.completed).toBe(0);
  });
});
