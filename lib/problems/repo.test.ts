import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { listProblems, getProblemBySlug } from "./repo";

const TEST_DB = "data/repo-test.db";

describe("problems/repo", () => {
  beforeEach(() => {
    __resetDbCache();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const db = getDb(TEST_DB);
    seedProblems(db);
  });

  it("listProblems returns all seeded problems", () => {
    const all = listProblems(getDb(TEST_DB));
    expect(all.length).toBe(3);
    expect(all.map((p) => p.slug).sort()).toEqual([
      "contains-duplicate",
      "two-sum",
      "valid-anagram",
    ]);
  });

  it("getProblemBySlug returns hydrated problem with parsed test_cases", () => {
    const p = getProblemBySlug(getDb(TEST_DB), "two-sum");
    expect(p).not.toBeNull();
    expect(p!.method_name).toBe("twoSum");
    expect(p!.test_cases.length).toBe(2);
  });

  it("getProblemBySlug returns null for unknown slug", () => {
    expect(getProblemBySlug(getDb(TEST_DB), "no-such")).toBeNull();
  });
});
