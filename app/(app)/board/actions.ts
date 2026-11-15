"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import { getReviewState, upsertReview } from "@/lib/sr/repo";

export async function markRevisit(problemId: number): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = Number(session.user.id);
  const db = getDb();
  if (!listProblems(db).some((p) => p.id === problemId)) throw new Error("Unknown problem");
  const prev = getReviewState(db, userId, problemId);
  upsertReview(db, {
    user_id: userId,
    problem_id: problemId,
    // Tomorrow, unless it is already due sooner: flagging must never postpone.
    due_at: Math.min(prev?.due_at ?? Infinity, Date.now() + 86_400_000),
    ease: prev?.ease ?? 2.5,
    // 1 is the "flagged for revisit" marker: an accepted submission never schedules under 6 days.
    interval_days: 1,
  });
  // The mark can come from the workspace; a board cached in the router must not stay stale.
  revalidatePath("/board");
}
