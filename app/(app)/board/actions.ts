"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import { getReviewState, upsertReview } from "@/lib/sr/repo";
import { MASTERY_INTERVAL_DAYS, moveRefusal, type Stage } from "@/lib/lifecycle/stage";

const DAY_MS = 86_400_000;

async function signedInUser(problemId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = getDb();
  if (!listProblems(db).some((p) => p.id === problemId)) throw new Error("Unknown problem");
  return { db, userId: Number(session.user.id) };
}

export async function markRevisit(problemId: number): Promise<void> {
  const { db, userId } = await signedInUser(problemId);
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
  // The mark can come from the workspace; a board cached in the router must not stay stale.
  revalidatePath("/board");
}

/**
 * A card dragged to another column. Returns the reason when the move is
 * refused (a thrown message would be replaced by a generic one in production).
 */
export async function moveCard(
  problemId: number,
  to: Stage,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { db, userId } = await signedInUser(problemId);
  const { attempts, passDays } = db
    .prepare(
      `SELECT COUNT(*) AS attempts,
              COUNT(DISTINCT CASE WHEN status = 'passed' THEN created_at / 86400 END) AS passDays
       FROM attempts WHERE user_id = ? AND problem_id = ?`,
    )
    .get(userId, problemId) as { attempts: number; passDays: number };
  const reason = moveRefusal({ attempted: attempts > 0, solved: passDays > 0, passDays }, to);
  if (reason) return { ok: false, reason };

  if (to === "revisit") {
    await markRevisit(problemId);
    return { ok: true };
  }
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
  revalidatePath("/board");
  return { ok: true };
}
