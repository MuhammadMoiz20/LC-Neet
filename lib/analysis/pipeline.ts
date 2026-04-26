import type Database from "better-sqlite3";
import { runOne } from "./run-one";
import {
  upsertAnalysis,
  getByAttempt,
  bumpPattern,
  recordMistake,
  type AnalysisKind,
} from "./repo";

const KINDS_BASE: AnalysisKind[] = [
  "grade",
  "quality",
  "complexity",
  "comparison",
  "pattern",
  "mistake",
];

export type PipelineContext = {
  attemptId: number;
  userId: number;
  problemId: number;
  code: string;
  problemTitle: string;
  problemTopic: string;
  problemDifficulty: string;
  problemDescription: string;
  mode?: string;
};

export async function runPipeline(
  db: Database.Database,
  ctx: PipelineContext,
  opts: { force?: boolean } = {},
): Promise<void> {
  const interview = ctx.mode === "interview";
  const kinds: AnalysisKind[] = interview
    ? [...KINDS_BASE, "interview_debrief"]
    : KINDS_BASE;
  if (!opts.force) {
    const existing = getByAttempt(db, ctx.attemptId);
    if (
      existing.length === kinds.length &&
      existing.every((r) => r.status !== "pending")
    ) {
      return; // idempotent short-circuit
    }
  }
  for (const kind of kinds) {
    upsertAnalysis(db, {
      attempt_id: ctx.attemptId,
      kind,
      content_md: "",
      status: "pending",
    });
  }
  await Promise.allSettled(
    kinds.map(async (kind) => {
      const result = await runOne({
        kind,
        code: ctx.code,
        problemTitle: ctx.problemTitle,
        problemTopic: ctx.problemTopic,
        problemDifficulty: ctx.problemDifficulty,
        problemDescription: ctx.problemDescription,
      });
      upsertAnalysis(db, {
        attempt_id: ctx.attemptId,
        kind: result.kind,
        content_md: result.content_md,
        status: result.status,
      });
      if (kind === "pattern" && result.status === "done") {
        const m = result.content_md.match(/^Pattern:\s*([^\n]+)/);
        if (m) bumpPattern(db, ctx.userId, m[1].trim());
      }
      if (kind === "mistake" && result.status === "done") {
        const m = result.content_md.match(/^Category:\s*([^\n]+)\n([\s\S]+)/);
        if (m) {
          const category = m[1].trim();
          if (category !== "none") {
            recordMistake(db, {
              user_id: ctx.userId,
              problem_id: ctx.problemId,
              attempt_id: ctx.attemptId,
              category,
              note: m[2].trim(),
            });
          }
        }
      }
    }),
  );
}
