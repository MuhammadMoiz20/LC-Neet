import type Database from "libsql";
import { listProblems } from "@/lib/problems/repo";
import { getLatestAttemptByProblem } from "@/lib/stats/repo";
import { listReviews } from "@/lib/sr/repo";
import { listMarks } from "./starts";
import { getPatternName, topicToPatternId } from "@/lib/patterns/groups";
import { MASTERY_MIN_PASS_DAYS, STAGES, problemStage, type Stage } from "./stage";

export type BoardCard = {
  problemId: number;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  patternName: string;
  stage: Stage;
  dueAt: number | null;
  /** Facts the move rules need (see moveRefusal). */
  attempted: boolean;
  submitted: boolean;
  solved: boolean;
  passDays: number;
};

export type BoardColumn = { id: Stage; name: string; blurb: string; cards: BoardCard[] };

export function getBoard(db: Database.Database, userId: number, nowMs: number): BoardColumn[] {
  // Days (UTC) with an accepted attempt, per problem; a problem with a row here is solved.
  const passDays = new Map(
    (
      db
        .prepare(
          `SELECT problem_id, COUNT(DISTINCT created_at / 86400) AS days
           FROM attempts WHERE user_id = ? AND status = 'passed' GROUP BY problem_id`,
        )
        .all(userId) as { problem_id: number; days: number }[]
    ).map((r) => [r.problem_id, r.days]),
  );
  const submitted = getLatestAttemptByProblem(db, userId);
  const marks = listMarks(db, userId);
  const reviews = new Map(listReviews(db, userId).map((r) => [r.problem_id, r]));

  const columns: BoardColumn[] = STAGES.map((s) => ({ ...s, cards: [] }));
  const byStage = new Map(columns.map((c) => [c.id, c.cards]));

  // listProblems is ordered by id, so every column starts out in problem-id order.
  for (const p of listProblems(db)) {
    const review = reviews.get(p.id) ?? null;
    const mark = marks.get(p.id);
    const attempted = submitted.has(p.id) || mark?.started === true;
    let stage = problemStage({ attempted, solved: passDays.has(p.id), review }, nowMs);
    if (stage === "mastered" && passDays.get(p.id)! < MASTERY_MIN_PASS_DAYS) stage = "solved";
    // Where the user put it by hand wins over what the history implies.
    if (mark?.pinned) stage = mark.pinned;
    byStage.get(stage)!.push({
      problemId: p.id,
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      patternName: getPatternName(topicToPatternId(p.topic)),
      stage,
      dueAt: review?.due_at ?? null,
      attempted,
      submitted: submitted.has(p.id),
      solved: passDays.has(p.id),
      passDays: passDays.get(p.id) ?? 0,
    });
  }

  // Most overdue first; a card pinned here without a schedule goes last.
  byStage.get("revisit")!.sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
  return columns;
}
