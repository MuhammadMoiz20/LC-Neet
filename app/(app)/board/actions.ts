"use server";
import type Database from "libsql";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import { getReviewState, upsertReview } from "@/lib/sr/repo";
import { getBoard } from "@/lib/lifecycle/board";
import { MASTERY_INTERVAL_DAYS, fitsHistory, type Stage } from "@/lib/lifecycle/stage";
import {
  clearStarted,
  listMarks,
  markStarted as startProblem,
  setPin,
} from "@/lib/lifecycle/starts";
import { endOfLocalDay, userTzOffsetSec } from "@/lib/time/local-day";

const DAY_MS = 86_400_000;

async function signedInUser(problemId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = getDb();
  if (!listProblems(db).some((p) => p.id === problemId)) throw new Error("Unknown problem");
  return { db, userId: Number(session.user.id) };
}

function flagForRevisit(db: Database.Database, userId: number, problemId: number) {
  const prev = getReviewState(db, userId, problemId);
  upsertReview(db, {
    user_id: userId,
    problem_id: problemId,
    // Tomorrow, unless it is already due sooner: flagging must never postpone.
    due_at: Math.min(prev?.due_at ?? Infinity, Date.now() + DAY_MS),
    ease: prev?.ease ?? 2.5,
    // 1 is the "flagged for revisit" marker: an accepted submission never schedules under 6 days.
    interval_days: 1,
  });
}

export async function markRevisit(problemId: number): Promise<void> {
  const { db, userId } = await signedInUser(problemId);
  flagForRevisit(db, userId, problemId);
  setPin(db, userId, problemId, null); // an older pin must not hide the flag
  // The mark can come from the workspace; a board cached in the router must not stay stale.
  revalidatePath("/board");
}

/** The workspace calls this when a problem is opened: Not started -> Attempting. */
export async function markStarted(problemId: number): Promise<void> {
  const { db, userId } = await signedInUser(problemId);
  // Only the first open changes anything worth refreshing other pages for.
  if (startProblem(db, userId, problemId)) revalidatePath("/", "layout");
}

/**
 * A card moved to another column. Any card can go anywhere. Where the move
 * agrees with the problem's history it is expressed through real state (the
 * "opened" record, the review schedule); otherwise it is kept as a pin, which
 * lasts until the problem is submitted again.
 */
export async function moveCard(problemId: number, to: Stage): Promise<void> {
  const { db, userId } = await signedInUser(problemId);
  setPin(db, userId, problemId, null);

  const { attempts, passDays } = db
    .prepare(
      `SELECT COUNT(*) AS attempts,
              COUNT(DISTINCT CASE WHEN status = 'passed' THEN created_at / 86400 END) AS passDays
       FROM attempts WHERE user_id = ? AND problem_id = ?`,
    )
    .get(userId, problemId) as { attempts: number; passDays: number };
  const submitted = attempts > 0;
  const facts = {
    attempted: submitted || listMarks(db, userId).get(problemId)?.started === true,
    submitted,
    solved: passDays > 0,
    passDays,
  };

  if (fitsHistory(facts, to)) {
    if (to === "revisit") {
      flagForRevisit(db, userId, problemId);
    } else if (to === "todo" || to === "attempting") {
      // Nothing has been accepted, so the only state to undo is the "opened"
      // record and a revisit flag.
      db.prepare(`DELETE FROM review_queue WHERE user_id = ? AND problem_id = ?`).run(userId, problemId);
      if (to === "todo") clearStarted(db, userId, problemId);
      else startProblem(db, userId, problemId);
    } else {
      const prev = getReviewState(db, userId, problemId);
      // Solved: back to the first-pass spacing. Mastered: at least the mastery interval.
      const interval =
        to === "solved" ? 6 : Math.max(prev?.interval_days ?? 0, MASTERY_INTERVAL_DAYS);
      upsertReview(db, {
        user_id: userId,
        problem_id: problemId,
        due_at: Date.now() + interval * DAY_MS,
        ease: prev?.ease ?? 2.5,
        interval_days: interval,
      });
    }
  }

  // Whatever the history says, the card ends up where it was dropped.
  const dueBy = endOfLocalDay(Date.now(), await userTzOffsetSec());
  const landed = getBoard(db, userId, dueBy).find((c) =>
    c.cards.some((card) => card.problemId === problemId),
  )!.id;
  if (landed !== to) setPin(db, userId, problemId, to);
  revalidatePath("/", "layout");
}
