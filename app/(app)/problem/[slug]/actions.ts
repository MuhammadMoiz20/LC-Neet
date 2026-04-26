"use server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { recordAttempt, listAttempts, type AttemptStatus } from "@/lib/attempts/repo";
import { upsertReview, getReviewState } from "@/lib/sr/repo";
import { nextReview, gradeFromAttempt } from "@/lib/sr/sm2";
import { listMessages } from "@/lib/chat/repo";
import { getDaily, markDailyComplete } from "@/lib/daily/repo";

export async function submitAttempt(input: {
  problemId: number;
  code: string;
  status: AttemptStatus;
  runtimeMs: number | null;
  mode: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = Number(session.user.id);
  const db = getDb();
  const attemptId = recordAttempt(db, {
    user_id: userId,
    problem_id: input.problemId,
    code: input.code,
    status: input.status,
    runtime_ms: input.runtimeMs,
    mode: input.mode,
  });

  if (input.status === "passed") {
    const attemptCount = listAttempts(db, userId, input.problemId).length;
    const usedHints = listMessages(db, userId, input.problemId).length > 0;
    const grade = gradeFromAttempt({
      status: "passed",
      attemptCount,
      usedHints,
    });
    const prev = getReviewState(db, userId, input.problemId);
    const nr = nextReview({
      ease: prev?.ease ?? 2.5,
      intervalDays: prev?.interval_days ?? 1,
      grade,
      now: Date.now(),
    });
    upsertReview(db, {
      user_id: userId,
      problem_id: input.problemId,
      due_at: nr.dueAt,
      ease: nr.ease,
      interval_days: nr.intervalDays,
    });

    const today = new Date().toISOString().slice(0, 10);
    const daily = getDaily(db, userId, today);
    if (daily && daily.problem_id === input.problemId && !daily.completed) {
      markDailyComplete(db, userId, today);
    }
  }

  return attemptId;
}
