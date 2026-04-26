import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, __resetDbCache } from "../db";
import { seedProblems } from "../seed";
import { createUser } from "../auth/users";
import {
  upsertAnalysis,
  getByAttempt,
  listPatternCounters,
  listMistakesForUser,
  type AnalysisKind,
} from "./repo";

vi.mock("./run-one", () => ({ runOne: vi.fn() }));
import { runOne } from "./run-one";
import { runPipeline, type PipelineContext } from "./pipeline";

async function setup() {
  __resetDbCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "analysis-pipeline-"));
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
  const ctx: PipelineContext = {
    attemptId,
    userId: user.id,
    problemId: 1,
    code: "def f(): pass",
    problemTitle: "Two Sum",
    problemTopic: "array",
    problemDifficulty: "easy",
    problemDescription: "Find two numbers that add up to target.",
  };
  return { db, ctx, userId: user.id, attemptId };
}

const KINDS: AnalysisKind[] = [
  "quality",
  "complexity",
  "comparison",
  "pattern",
  "mistake",
];

describe("analysis/pipeline", () => {
  beforeEach(() => {
    vi.mocked(runOne).mockReset();
  });

  it("inserts 5 rows (one per kind) after run", async () => {
    const { db, ctx } = await setup();
    vi.mocked(runOne).mockImplementation(async ({ kind }) => ({
      kind,
      content_md: `body for ${kind}`,
      status: "done" as const,
    }));

    await runPipeline(db, ctx);

    const rows = getByAttempt(db, ctx.attemptId);
    expect(rows.length).toBe(5);
    expect(rows.map((r) => r.kind)).toEqual(KINDS);
    expect(rows.every((r) => r.status === "done")).toBe(true);
    expect(vi.mocked(runOne)).toHaveBeenCalledTimes(5);
  });

  it("idempotent short-circuit when all rows already done", async () => {
    const { db, ctx } = await setup();
    for (const kind of KINDS) {
      upsertAnalysis(db, {
        attempt_id: ctx.attemptId,
        kind,
        content_md: `pre ${kind}`,
        status: "done",
      });
    }
    vi.mocked(runOne).mockImplementation(async ({ kind }) => ({
      kind,
      content_md: "should not run",
      status: "done" as const,
    }));

    await runPipeline(db, ctx);

    expect(vi.mocked(runOne)).not.toHaveBeenCalled();
    const rows = getByAttempt(db, ctx.attemptId);
    expect(rows.length).toBe(5);
    expect(rows.map((r) => r.content_md)).toEqual(
      KINDS.map((k) => `pre ${k}`),
    );
  });

  it("one kind erroring leaves others done", async () => {
    const { db, ctx } = await setup();
    vi.mocked(runOne).mockImplementation(async ({ kind }) => {
      if (kind === "comparison") {
        return { kind, content_md: "[error: x]", status: "error" as const };
      }
      return { kind, content_md: `body for ${kind}`, status: "done" as const };
    });

    await runPipeline(db, ctx);

    const rows = getByAttempt(db, ctx.attemptId);
    const byKind = Object.fromEntries(rows.map((r) => [r.kind, r]));
    expect(byKind.comparison.status).toBe("error");
    expect(byKind.quality.status).toBe("done");
    expect(byKind.complexity.status).toBe("done");
    expect(byKind.pattern.status).toBe("done");
    expect(byKind.mistake.status).toBe("done");
  });

  it("pattern result bumps pattern_counters", async () => {
    const { db, ctx } = await setup();
    vi.mocked(runOne).mockImplementation(async ({ kind }) => {
      if (kind === "pattern") {
        return {
          kind,
          content_md: "Pattern: sliding window\nUsed two indices...",
          status: "done" as const,
        };
      }
      return { kind, content_md: `body for ${kind}`, status: "done" as const };
    });

    await runPipeline(db, ctx);

    const counters = listPatternCounters(db, ctx.userId);
    expect(counters.length).toBe(1);
    expect(counters[0].pattern).toBe("sliding window");
    expect(counters[0].solved_count).toBe(1);
  });

  it("mistake result records into mistakes table", async () => {
    const { db, ctx } = await setup();
    vi.mocked(runOne).mockImplementation(async ({ kind }) => {
      if (kind === "mistake") {
        return {
          kind,
          content_md: "Category: off_by_one\nForgot to handle empty input.",
          status: "done" as const,
        };
      }
      return { kind, content_md: `body for ${kind}`, status: "done" as const };
    });

    await runPipeline(db, ctx);

    const mistakes = listMistakesForUser(db, ctx.userId);
    expect(mistakes.length).toBe(1);
    expect(mistakes[0].category).toBe("off_by_one");
    expect(mistakes[0].note).toBe("Forgot to handle empty input.");
    expect(mistakes[0].problem_id).toBe(ctx.problemId);
  });

  it("interview mode runs 6 kinds and persists 6 rows", async () => {
    const { db, ctx } = await setup();
    vi.mocked(runOne).mockImplementation(async ({ kind }) => ({
      kind,
      content_md: `body for ${kind}`,
      status: "done" as const,
    }));

    await runPipeline(db, { ...ctx, mode: "interview" });

    const rows = getByAttempt(db, ctx.attemptId);
    expect(rows.length).toBe(6);
    expect(rows.map((r) => r.kind)).toEqual([...KINDS, "interview_debrief"]);
    expect(rows.every((r) => r.status === "done")).toBe(true);
    expect(vi.mocked(runOne)).toHaveBeenCalledTimes(6);
  });

  it("Category: none does not record a mistake", async () => {
    const { db, ctx } = await setup();
    vi.mocked(runOne).mockImplementation(async ({ kind }) => {
      if (kind === "mistake") {
        return {
          kind,
          content_md: "Category: none\nNo significant mistake observed.",
          status: "done" as const,
        };
      }
      return { kind, content_md: `body for ${kind}`, status: "done" as const };
    });

    await runPipeline(db, ctx);

    const mistakes = listMistakesForUser(db, ctx.userId);
    expect(mistakes.length).toBe(0);
  });
});
