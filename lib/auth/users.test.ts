import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "../db";
import { createUser, verifyPassword } from "./users";

const TEST_DB = "data/auth-test.db";

describe("auth/users", () => {
  beforeEach(() => {
    __resetDbCache();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it("creates a user with hashed password", async () => {
    const db = getDb(TEST_DB);
    const user = await createUser(db, "me@example.com", "hunter22");
    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe("me@example.com");
  });

  it("verifies correct password", async () => {
    const db = getDb(TEST_DB);
    await createUser(db, "me@example.com", "hunter22");
    expect(await verifyPassword(db, "me@example.com", "hunter22")).toBeTruthy();
    expect(await verifyPassword(db, "me@example.com", "wrong")).toBeNull();
  });
});
