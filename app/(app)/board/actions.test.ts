import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testState = { dbPath: "" };

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() })); // needs a request scope
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
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
import { getReviewState, upsertReview } from "@/lib/sr/repo";
import { auth } from "@/auth";
import { markRevisit } from "./actions";

const DAY = 86_400_000;
let userId: number;

beforeEach(async () => {
  __resetDbCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "board-actions-"));
  testState.dbPath = path.join(dir, "test.db");
  const db = getDb();
  seedProblems(db);
  userId = (await createUser(db, "u@test", "x")).id;
  vi.mocked(auth).mockResolvedValue({ user: { id: String(userId) } } as never);
});

afterEach(() => {
  __resetDbCache();
});

describe("markRevisit", () => {
  test("schedules the problem about one day ahead with interval 1", async () => {
    const before = Date.now();
    await markRevisit(1);
    const state = getReviewState(getDb(), userId, 1)!;
    expect(state.interval_days).toBe(1);
    expect(state.ease).toBe(2.5);
    expect(state.due_at).toBeGreaterThanOrEqual(before + DAY);
    expect(state.due_at).toBeLessThanOrEqual(Date.now() + DAY);
  });

  test("keeps an existing ease and is idempotent", async () => {
    upsertReview(getDb(), {
      user_id: userId,
      problem_id: 1,
      due_at: Date.now() + 30 * DAY,
      ease: 1.9,
      interval_days: 30,
    });
    await markRevisit(1);
    await markRevisit(1);
    const state = getReviewState(getDb(), userId, 1)!;
    expect(state).toMatchObject({ ease: 1.9, interval_days: 1 });
    expect(state.due_at).toBeLessThanOrEqual(Date.now() + DAY);
    const { n } = getDb()
      .prepare("SELECT COUNT(*) AS n FROM review_queue WHERE user_id = ?")
      .get(userId) as { n: number };
    expect(n).toBe(1);
  });

  test("throws for a problem that is not in the catalog", async () => {
    await expect(markRevisit(999_999)).rejects.toThrow("Unknown problem");
    await expect(markRevisit(Number.NaN)).rejects.toThrow("Unknown problem");
    const { n } = getDb().prepare("SELECT COUNT(*) AS n FROM review_queue").get() as { n: number };
    expect(n).toBe(0);
  });

  test("throws Unauthorized when signed out", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(markRevisit(1)).rejects.toThrow("Unauthorized");
    expect(getReviewState(getDb(), userId, 1)).toBeNull();
  });
});
