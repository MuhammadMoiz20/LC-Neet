import type Database from "libsql";
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

// A run cannot outlive the API route's maxDuration (300s), so a row still
// pending after that belongs to a run that died.
const RUN_BUDGET_SEC = 300;

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
  // Starting is idempotent: once an attempt has rows (pending, done, or error)
  // only an explicit rerun restarts it, so a second client asking to "start"
  // can never launch a duplicate set of LLM calls. The exception is a run that
  // died: its rows would stay pending forever, so a later start takes over.
  if (!opts.force) {
    const rows = getByAttempt(db, ctx.attemptId);
    const deadBefore = Date.now() / 1000 - RUN_BUDGET_SEC;
    const died = rows.some((r) => r.status === "pending" && r.created_at < deadBefore);
    if (rows.length > 0 && !died) return;
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
