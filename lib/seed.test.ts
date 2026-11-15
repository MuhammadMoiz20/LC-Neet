import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "./db";
import { seedProblems } from "./seed";
import { invalidateProblemCache } from "./problems/repo";

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
    expect(count).toBe(150);
    const row = db.prepare("SELECT method_name FROM problems WHERE slug = ?").get("two-sum") as { method_name: string };
    expect(row.method_name).toBe("twoSum");
    db.close();
  });

  it("is idempotent", () => {
    const db = getDb(TEST_DB);
    seedProblems(db);
    seedProblems(db);
    const count = (db.prepare("SELECT COUNT(*) as c FROM problems").get() as { c: number }).c;
    expect(count).toBe(150);
    db.close();
  });
});

describe("seedProblems change detection", () => {
  it("rewrites a row that drifted from the JSON and leaves the rest alone", () => {
    __resetDbCache();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const db = getDb(TEST_DB);
    seedProblems(db);
    db.prepare("UPDATE problems SET title = 'stale' WHERE id = 1").run();
    db.prepare("UPDATE problems SET slug = 'kept-slug' WHERE id = 2").run();
    invalidateProblemCache(db); // direct writes bypass the catalog cache
    seedProblems(db);
    const title = (db.prepare("SELECT title FROM problems WHERE id = 1").get() as { title: string }).title;
    expect(title).not.toBe("stale");
    // slug is not a seeded column, so an untouched row is never rewritten
    const slug = (db.prepare("SELECT slug FROM problems WHERE id = 2").get() as { slug: string }).slug;
    expect(slug).toBe("kept-slug");
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
