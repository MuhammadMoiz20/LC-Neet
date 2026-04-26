import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import { recordAttempt, listAttempts } from "./repo";

const TEST_DB = "data/attempts-test.db";

describe("attempts/repo", () => {
  beforeEach(async () => {
    __resetDbCache();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const db = getDb(TEST_DB);
    seedProblems(db);
    await createUser(db, "u@example.com", "pw");
  });

  it("records and lists attempts for a problem", () => {
    const db = getDb(TEST_DB);
    const id = recordAttempt(db, {
      user_id: 1,
      problem_id: 1,
      code: "x",
      status: "passed",
      runtime_ms: 12,
      mode: "run",
    });
    expect(id).toBeGreaterThan(0);
    const list = listAttempts(db, 1, 1);
    expect(list.length).toBe(1);
    expect(list[0].status).toBe("passed");
  });
});
