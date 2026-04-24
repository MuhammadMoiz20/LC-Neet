import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "./db";
import { seedProblems } from "./seed";

const TEST_DB = "data/seed-test.db";

describe("seedProblems", () => {
  beforeEach(() => {
    __resetDbCache();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it("inserts all problems", () => {
    const db = getDb(TEST_DB);
    seedProblems(db);
    const count = (db.prepare("SELECT COUNT(*) as c FROM problems").get() as { c: number }).c;
    expect(count).toBe(3);
    db.close();
  });

  it("is idempotent", () => {
    const db = getDb(TEST_DB);
    seedProblems(db);
    seedProblems(db);
    const count = (db.prepare("SELECT COUNT(*) as c FROM problems").get() as { c: number }).c;
    expect(count).toBe(3);
    db.close();
  });
});

describe("__resetDbCache", () => {
  it("clears cached connection so next getDb returns a fresh open db", () => {
    __resetDbCache();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const db1 = getDb(TEST_DB);
    __resetDbCache();
    expect(db1.open).toBe(false);
    const db2 = getDb(TEST_DB);
    expect(db2.open).toBe(true);
    expect(db2).not.toBe(db1);
    db2.close();
  });
});
