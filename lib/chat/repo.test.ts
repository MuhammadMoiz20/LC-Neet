import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import { saveMessage, listMessages } from "./repo";

const TEST_DB = "data/chat-test.db";

async function setup() {
  __resetDbCache();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const db = getDb(TEST_DB);
  seedProblems(db);
  const user = await createUser(db, "u@example.com", "pw");
  return { db, userId: user.id };
}

describe("chat/repo", () => {
  it("saveMessage + listMessages round-trip ordered ascending", async () => {
    const { db, userId } = await setup();
    saveMessage(db, { user_id: userId, problem_id: 1, role: "user", content: "hi", mode: "hints" });
    saveMessage(db, { user_id: userId, problem_id: 1, role: "assistant", content: "yo", mode: "hints" });
    const rows = listMessages(db, userId, 1);
    expect(rows.map((r) => [r.role, r.content])).toEqual([
      ["user", "hi"],
      ["assistant", "yo"],
    ]);
  });

  it("listMessages scopes by (user, problem)", async () => {
    const { db, userId } = await setup();
    saveMessage(db, { user_id: userId, problem_id: 1, role: "user", content: "p1", mode: "hints" });
    saveMessage(db, { user_id: userId, problem_id: 2, role: "user", content: "p2", mode: "hints" });
    const rows = listMessages(db, userId, 1);
    expect(rows.length).toBe(1);
    expect(rows[0].content).toBe("p1");
  });

  it("rejects invalid role", async () => {
    const { db, userId } = await setup();
    expect(() =>
      saveMessage(db, {
        user_id: userId,
        problem_id: 1,
        role: "bogus" as never,
        content: "x",
        mode: "hints",
      }),
    ).toThrow();
  });
});
