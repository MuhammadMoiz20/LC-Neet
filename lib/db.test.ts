import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "./db";
import fs from "node:fs";

const TEST_DB = "data/test.db";

describe("getDb", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it("creates schema on first call", () => {
    const db = getDb(TEST_DB);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toContain("users");
    expect(tables).toContain("problems");
    expect(tables).toContain("attempts");
    const cols = (db.prepare("PRAGMA table_info(problems)").all() as { name: string }[]).map((r) => r.name);
    expect(cols).toContain("method_name");
    db.close();
  });

  it("is idempotent", () => {
    getDb(TEST_DB).close();
    expect(() => getDb(TEST_DB).close()).not.toThrow();
  });
});
